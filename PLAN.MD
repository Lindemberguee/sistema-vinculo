# SaaS de Doação Multi-tenant — Plano Técnico

## Context

Não existe código ainda: o diretório atual (`Nota Fiscal`) contém apenas landing pages estáticas do Instituto Verdescola. Este plano cria um **projeto novo, do zero**, em repositório separado.

O objetivo é uma plataforma SaaS onde ONGs se cadastram, passam por KYC, criam campanhas com páginas públicas montadas em um **page builder por blocos**, e recebem doações (avulsas e recorrentes) via **Pagar.me v5 com split automático** — a plataforma retém sua taxa na própria transação. Concorrentes de referência: Doare, Doação Solutions, Doatividade.

Decisões já fechadas com o usuário:
- Stack: **Next.js (App Router) + Postgres/Prisma + Redis/BullMQ**, monorepo TypeScript
- Gateway: **Pagar.me v5** (split nativo, Pix/cartão/boleto, assinaturas)
- Páginas: **page builder por blocos** (schema JSON desde o início)
- Domínios: **subdomínio por ONG + domínio próprio opcional** (plano superior)
- Monetização: **mensalidade (planos) + % por transação**, com preço competitivo
- MVP inclui os 4 módulos: doações, campanhas/páginas, onboarding+KYC+split, CRM+relatórios

> Escopo grande. O plano entrega em **6 fases**; a Fase 3 é o primeiro release comercializável.

---

## 1. Arquitetura

### Monorepo (pnpm workspaces + Turborepo)

```
donation-saas/
├── apps/
│   ├── web/          # Next.js — painel da ONG + admin da plataforma + páginas públicas
│   └── worker/       # Node standalone — BullMQ (webhooks, e-mails, recorrência, relatórios)
├── packages/
│   ├── db/           # Prisma schema + client + seeds + migrations
│   ├── payments/     # abstração de gateway (interface + adapter Pagar.me)
│   ├── blocks/       # schema Zod dos blocos + renderer React + editor
│   ├── emails/       # templates React Email
│   └── shared/       # tipos, money (centavos), erros, utils, feature flags
└── infra/            # docker-compose (postgres, redis, mailhog), CI
```

### Serviços de runtime
| Peça | Escolha | Motivo |
|---|---|---|
| App | Next.js 15 App Router | SSR/ISR nas páginas públicas (SEO das campanhas) + painel no mesmo repo |
| Banco | Postgres 16 + Prisma | relacional, transações, RLS opcional depois |
| Fila | Redis + BullMQ | webhooks assíncronos, retries, cron de recorrência |
| Storage | S3/Cloudflare R2 | imagens das campanhas, documentos de KYC |
| E-mail | Resend + React Email | recibos, confirmações, réguas |
| Auth | Auth.js (credentials + Google) | sessão em cookie httpOnly, org via claim |
| Observabilidade | Sentry + logs estruturados (pino) | rastrear falha de pagamento é crítico |
| Hospedagem | Vercel (web) + VPS/Railway (worker, redis) ou tudo em VPS com Docker | worker precisa de processo longo |

### Multi-tenancy
**Single database, discriminador `organizationId` em toda tabela de domínio.** Nunca query sem `organizationId` — encapsular em um `tenantPrisma(orgId)` que injeta o filtro. Considerar Postgres RLS na Fase 5 como defesa em profundidade.

**Resolução de tenant por host** em `apps/web/middleware.ts`:
- `app.plataforma.com.br` → painel (tenant vem da sessão)
- `admin.plataforma.com.br` → back-office interno
- `{slug}.plataforma.com.br` → páginas públicas, lookup por `Organization.slug`
- `doe.ong.org.br` (CNAME) → lookup em `CustomDomain`, cache no Redis (TTL 5min)

O middleware reescreve para `/_sites/[host]/...`. SSL do domínio próprio: Vercel Domains API ou Caddy com on-demand TLS se em VPS.

---

## 2. Modelo de dados (Prisma — tabelas principais)

`packages/db/prisma/schema.prisma`. Todo dinheiro em **centavos (`Int`)**, nunca float.

```prisma
// ── Tenancy & acesso ────────────────────────────────
model Organization {
  id            String   @id @default(cuid())
  slug          String   @unique          // subdomínio
  legalName     String
  cnpj          String   @unique
  status        OrgStatus @default(PENDING_KYC) // PENDING_KYC | ACTIVE | SUSPENDED
  planId        String
  branding      Json     // logo, cores, fontes
  // dados do recebedor no gateway
  gatewayRecipientId String?              // pagar.me recipient (rp_...)
  kycStatus     KycStatus @default(NOT_STARTED)
  createdAt     DateTime @default(now())
}

model User { id String @id; email String @unique; passwordHash String?; name String }
model Membership { userId String; organizationId String; role Role } // OWNER|ADMIN|FINANCE|EDITOR|VIEWER
model CustomDomain { id String @id; organizationId String; host String @unique; verifiedAt DateTime?; sslStatus String }

// ── Planos & assinatura da plataforma ───────────────
model Plan {
  id String @id                      // free | essencial | pro | enterprise
  name String
  monthlyCents Int
  platformFeeBps Int                 // taxa % em basis points (ex.: 490 = 4,90%)
  platformFeeFixedCents Int          // ex.: 0 ou 100
  limits Json                        // maxCampaigns, maxUsers, customDomain, modules[]
}
model Subscription { organizationId String; planId String; status String; currentPeriodEnd DateTime; gatewaySubscriptionId String? }

// ── Campanhas & páginas ─────────────────────────────
model Campaign {
  id String @id @default(cuid())
  organizationId String
  slug String                        // único por org
  title String
  type CampaignType                  // DONATION | CROWDFUNDING | APADRINHAMENTO | EVENT (fase 5)
  goalCents Int?
  endsAt DateTime?
  status CampaignStatus              // DRAFT | PUBLISHED | PAUSED | CLOSED
  // agregados desnormalizados, atualizados em transação com a doação paga
  raisedCents Int @default(0)
  donorsCount Int @default(0)
  seo Json                           // title, description, ogImage
  @@unique([organizationId, slug])
}

model Page {
  id String @id
  campaignId String?                 // null = página institucional da org
  organizationId String
  blocks Json                        // Block[] validado por Zod — ver §4
  publishedBlocks Json?              // versão live; `blocks` é o rascunho
  publishedAt DateTime?
}
model PageVersion { id String @id; pageId String; blocks Json; createdBy String; createdAt DateTime } // histórico/rollback

model DonationOption {                // valores sugeridos e o que representam
  id String @id; campaignId String; amountCents Int; label String; impactText String?; recurringOnly Boolean
}

// ── Doadores (CRM) ──────────────────────────────────
model Donor {
  id String @id
  organizationId String
  email String
  name String
  documentHash String?               // CPF/CNPJ hash p/ dedupe; documento cifrado à parte
  phone String?
  address Json?
  // agregados p/ RFM
  totalDonatedCents Int @default(0)
  donationsCount Int @default(0)
  firstDonationAt DateTime?
  lastDonationAt DateTime?
  rfmSegment String?                 // calculado por job noturno
  consent Json                       // LGPD: optIn e-mail/whatsapp, data, origem
  @@unique([organizationId, email])
}
model DonorTag { donorId String; tag String }

// ── Doações & dinheiro ──────────────────────────────
model Donation {
  id String @id @default(cuid())
  organizationId String
  campaignId String?
  donorId String
  recurringPlanId String?            // se veio de recorrência
  amountCents Int                    // valor bruto pago pelo doador
  tipCents Int @default(0)           // gorjeta opcional (cobrir taxa)
  platformFeeCents Int               // nosso split
  gatewayFeeCents Int                // taxa do Pagar.me (vem no webhook)
  netToOrgCents Int
  method PaymentMethod               // PIX | CREDIT_CARD | BOLETO
  status DonationStatus              // ver §3
  anonymous Boolean @default(false)
  message String?
  gatewayOrderId String?  @unique
  gatewayChargeId String? @unique
  paidAt DateTime?
  refundedAt DateTime?
  metadata Json                      // utm, origem, blockId do checkout
  createdAt DateTime @default(now())
  @@index([organizationId, status, createdAt])
}

model RecurringPlan {                 // assinatura do doador com a ONG
  id String @id
  organizationId String; donorId String; campaignId String?
  amountCents Int
  method PaymentMethod               // CREDIT_CARD (assinatura Pagar.me) | PIX (cobrança agendada própria)
  interval String                    // MONTHLY | YEARLY
  status String                      // ACTIVE | PAST_DUE | CANCELED
  gatewaySubscriptionId String?
  nextChargeAt DateTime
  failedAttempts Int @default(0)
}

model GatewayEvent {                  // idempotência de webhook — obrigatório
  id String @id                       // event id do Pagar.me
  type String
  payload Json
  processedAt DateTime?
  error String?
  receivedAt DateTime @default(now())
}

model Payout { id String @id; organizationId String; amountCents Int; status String; gatewayTransferId String?; paidAt DateTime? }
model AuditLog { id String @id; organizationId String?; userId String?; action String; entity String; entityId String; diff Json; ip String; createdAt DateTime }
```

---

## 3. Fluxo de pagamento e split (Pagar.me v5)

### Máquina de estados da doação
```
CREATED ──▶ PENDING ──▶ PAID ──▶ (REFUNDED | CHARGED_BACK)
   │           │
   │           ├──▶ FAILED
   └──────────▶ EXPIRED        (Pix/boleto vencido)
```
Regras:
- `raisedCents`/`donorsCount` da campanha e agregados do `Donor` só mudam nas transições **para** `PAID` e **saindo** de `PAID` — sempre dentro da mesma transação Postgres.
- Toda transição é escrita em `AuditLog`.

### Abstração de gateway — `packages/payments`
```ts
export interface PaymentGateway {
  createRecipient(org: OrgKycData): Promise<{ recipientId: string }>
  getRecipientStatus(id: string): Promise<KycStatus>
  createOrder(input: CreateOrderInput): Promise<OrderResult>   // pix/cartão/boleto + split
  createSubscription(input: CreateSubscriptionInput): Promise<{ subscriptionId: string }>
  cancelSubscription(id: string): Promise<void>
  refund(chargeId: string, amountCents?: number): Promise<void>
  verifyWebhook(rawBody: string, headers: Headers): WebhookEvent
}
```
Implementar `PagarmeGateway`. Nenhum código de domínio importa `pagarme` diretamente — troca de gateway fica isolada.

### Split
No `createOrder`, enviar `split` com dois recebedores:
```ts
split: [
  { recipient_id: org.gatewayRecipientId, type: 'flat', amount: netToOrgCents,
    options: { liable: true, charge_processing_fee: false, charge_remainder_fee: false } },
  { recipient_id: PLATFORM_RECIPIENT_ID, type: 'flat', amount: platformFeeCents,
    options: { liable: true, charge_processing_fee: true, charge_remainder_fee: true } },
]
```
- **A plataforma absorve a taxa do gateway** (`charge_processing_fee: true` no nosso recebedor) → a ONG recebe valor previsível. Isso precisa entrar na precificação.
- Cálculo em `packages/payments/src/fee.ts`, função pura e 100% testada:
  `platformFeeCents = ceil(amountCents * plan.platformFeeBps / 10000) + plan.platformFeeFixedCents`
  `netToOrgCents = amountCents + tipCents - platformFeeCents` (a gorjeta vai integralmente para a taxa; se `tip >= fee`, ONG recebe 100% do valor doado).
- Guard: `netToOrgCents > 0` e soma dos splits === valor da cobrança. Rejeitar antes de chamar a API.

### Webhooks — `apps/web/app/api/webhooks/pagarme/route.ts`
1. Ler o **raw body** (`export const runtime = 'nodejs'`, sem parse), validar assinatura HMAC.
2. `INSERT ... ON CONFLICT DO NOTHING` em `GatewayEvent` → se já existia, responder 200 e sair (**idempotência**).
3. Enfileirar no BullMQ e responder **200 em <1s**. Todo processamento no worker.
4. Worker trata: `order.paid`, `charge.paid`, `charge.payment_failed`, `charge.refunded`, `charge.chargedback`, `subscription.charged`, `subscription.canceled`, `recipient.updated` (KYC).
5. Retry com backoff exponencial; após N falhas → DLQ + alerta no Sentry.

### Recorrência
- **Cartão:** assinatura nativa do Pagar.me. Régua de dunning: retry D+3, D+7, D+14, e-mail de atualização de cartão, `PAST_DUE` → `CANCELED`.
- **Pix recorrente:** o Pagar.me não garante débito automático — implementar job diário no worker que gera um novo QR Code na `nextChargeAt` e dispara e-mail/WhatsApp com o link. (É o diferencial que o Doare vende; vale implementar bem.)

### Conciliação
Job noturno: comparar `Donation` local com as charges do dia na API do gateway; divergências vão para uma fila de revisão no admin. Sem isso, webhook perdido = dinheiro fantasma.

---

## 4. Page builder por blocos

### Schema — `packages/blocks`
Cada bloco é `{ id, type, props }`, validado por Zod. `Page.blocks` é `Block[]`.

Blocos do MVP: `hero`, `richText`, `image`, `gallery`, `donationCheckout` (âncora), `amountOptions`, `progressBar`, `impactCounters`, `testimonials`, `faq`, `videoEmbed`, `cta`, `donorWall`, `footer`.

```ts
export const HeroBlock = z.object({
  type: z.literal('hero'),
  id: z.string(),
  props: z.object({
    title: z.string().max(120),
    subtitle: z.string().max(240).optional(),
    backgroundImageId: z.string().optional(),
    overlay: z.number().min(0).max(1).default(0.4),
    ctaLabel: z.string().default('Doar agora'),
    ctaTarget: z.enum(['checkout', 'url']).default('checkout'),
  }),
})
export const Block = z.discriminatedUnion('type', [HeroBlock, RichTextBlock, /* ... */])
```

**Regra central:** um único registry `blockRegistry: Record<BlockType, { schema, Renderer, Editor, defaults, icon, label }>`. Adicionar um bloco = adicionar uma entrada. O renderer é **Server Component** (SEO/performance); só `donationCheckout` e `impactCounters` são client.

### Editor
- Layout: sidebar de blocos → canvas (preview real, usa os mesmos renderers) → painel de propriedades.
- `dnd-kit` para reordenar. Estado local com Zustand, autosave debounced em `blocks` (rascunho).
- **Publicar** copia `blocks` → `publishedBlocks`, grava `PageVersion` e revalida a tag ISR (`revalidateTag('page:'+id)`).
- Sanitização: `richText` passa por sanitizer no servidor antes de gravar; nunca `dangerouslySetInnerHTML` com input cru. Sem HTML/JS arbitrário do usuário (é o vetor de XSS mais óbvio num builder multi-tenant).

### Renderização pública
`apps/web/app/_sites/[host]/[campaignSlug]/page.tsx` — Server Component, `generateMetadata` a partir de `Campaign.seo`, ISR com tag por página, OG image dinâmica via `next/og`.

---

## 5. Checkout de doação

Rota pública `POST /api/public/donations` (rate-limited por IP + campanha):
1. Validar payload com Zod (valor mínimo, campanha `PUBLISHED` e da org do host, método permitido).
2. Upsert `Donor` por `(organizationId, email)`; registrar consentimento LGPD.
3. Calcular taxas com `fee.ts` **no servidor** — nunca confiar em valor de taxa vindo do cliente.
4. `gateway.createOrder(...)` com `idempotencyKey` derivado de um `donationId` gerado antes da chamada.
5. Criar `Donation` em `PENDING`; devolver ao cliente só o necessário (QR Code Pix / linha digitável / status do cartão).
6. Confirmação **só via webhook**. O front faz polling em `GET /api/public/donations/:id/status`.

Cartão: tokenização no browser com a chave pública do Pagar.me — **dados de cartão nunca tocam nosso servidor** (mantém escopo PCI SAQ-A).

---

## 6. Onboarding + KYC

Wizard: dados da ONG (CNPJ, razão social, endereço) → representante legal → dados bancários → upload de documentos (estatuto, ata, CNPJ, doc do responsável) → aceite dos termos.

- Upload direto para S3 via URL pré-assinada; bucket **privado**, leitura só por URL assinada de curta duração, restrita a `role: OWNER|ADMIN` da org e ao admin da plataforma.
- `createRecipient` no Pagar.me; `Organization.status` fica `PENDING_KYC` até `recipient.updated` retornar aprovado.
- **Campanha não publica e checkout não aceita pagamento enquanto `status !== ACTIVE`** — validar no servidor, não só escondendo botão.

---

## 7. CRM + relatórios

- Listagem de doadores com filtros (período, valor, método, recorrente, campanha, tag), exportação CSV via job (não gerar em request).
- Job noturno de **RFM**: quantis de Recência/Frequência/Valor por org → `rfmSegment` (Campeões, Fiéis, Em risco, Perdidos, Novos...).
- Dashboard: arrecadado no período, ticket médio, nº de doadores, taxa de recorrência, churn de recorrentes, funil da campanha (views → checkout iniciado → pago). Queries agregadas com índices em `(organizationId, status, createdAt)`; se ficar lento, tabela `DailyStats` materializada por job.

---

## 8. Precificação (para competir)

Referência de mercado BR: plataformas de doação cobram ~4–8% + taxa fixa; assinaturas de R$0 a R$500+/mês.

Sugestão inicial (ajustável em `Plan`, sem deploy):

| Plano | Mensal | Taxa/transação | Inclui |
|---|---|---|---|
| Free | R$ 0 | 6,9% | 1 campanha, subdomínio, marca da plataforma no rodapé |
| Essencial | R$ 99 | 4,9% | campanhas ilimitadas, CRM, sem marca |
| Pro | R$ 299 | 3,9% | domínio próprio, recorrência Pix, integrações, 10 usuários |
| Enterprise | sob consulta | 2,9%+ | SSO, SLA, módulos extras |

A **gorjeta opcional do doador** ("cobrir a taxa da plataforma") deve estar no checkout desde o MVP — é o que permite anunciar "sua ONG recebe 100%" e diminui a fricção da taxa. Já está modelado em `Donation.tipCents`.

⚠️ Margem real = `platformFeeBps` − taxa do Pagar.me (Pix ~0,99%, cartão ~3,5–4,5% + antecipação). Antes de fechar preço, montar uma planilha de margem por método; **cartão parcelado com 3,9% dá prejuízo**. Considerar taxa diferente por método (Pix mais barato) — o schema já suporta se `platformFeeBps` virar `Json` por método.

---

## 9. Segurança & LGPD (não negociável)

- Autorização em **toda** query: helper `requireOrgAccess(session, orgId, role)`. Nada de confiar em `orgId` vindo do body.
- Zod em todo boundary (route handlers, server actions, webhooks).
- CPF/CNPJ do doador cifrado em repouso (`pgcrypto` ou envelope encryption); `documentHash` só para dedupe.
- Rate limit em checkout, login e recuperação de senha (Upstash/Redis).
- Secrets só em env; chave secreta do Pagar.me nunca no bundle client (`NEXT_PUBLIC_` só para a chave pública).
- LGPD: base legal registrada em `Donor.consent`, endpoints de exportação e exclusão de dados, política de retenção, DPA com subprocessadores.
- `AuditLog` em: mudança de dados bancários, publicação de página, estorno, alteração de plano, convite de usuário.

---

## 10. Fases de entrega

| Fase | Entrega | Resultado |
|---|---|---|
| **0 — Fundação** | monorepo, Prisma + migrations, auth, membership/roles, middleware de tenant, docker-compose, CI | login e org isolada funcionando |
| **1 — Dinheiro** | `packages/payments`, adapter Pagar.me, checkout Pix+cartão+boleto, webhooks idempotentes, split, recibo por e-mail | uma doação real cai na conta com split correto |
| **2 — Campanhas & builder** | CRUD de campanha, schema de blocos, renderer SSR, editor drag-and-drop, publicação/ISR, subdomínio | ONG cria e publica página sozinha |
| **3 — Onboarding & KYC** *(1º release comercial)* | wizard, upload S3, criação de recipient, planos e assinatura da plataforma, gorjeta no checkout | ONGs entram sem intervenção manual |
| **4 — CRM & relatórios** | base de doadores, filtros, exportação, dashboard, RFM, conciliação diária | retenção e valor percebido |
| **5 — Escala** | recorrência Pix, domínio próprio + SSL, réguas de e-mail, webhooks de saída, admin da plataforma, RLS | plano Pro completo |
| **6 — Módulos** | rifa, leilão, eventos/ingressos, apadrinhamento, doação internacional | paridade com Doare |

---

## 11. Verificação

- **Testes unitários (Vitest):** `fee.ts` (matriz de valores × planos × gorjeta, incluindo arredondamento e `net > 0`), validação dos schemas de bloco, redutores da máquina de estados.
- **Integração (Vitest + Postgres em Testcontainers):** handler de webhook — mesmo evento 2× não duplica `Donation` nem soma `raisedCents` duas vezes; refund reverte agregados; doação em org `PENDING_KYC` é rejeitada; query de org A nunca retorna dado de org B.
- **E2E (Playwright):** criar campanha → publicar → abrir subdomínio → doar via Pix no **sandbox do Pagar.me** → simular webhook `charge.paid` → conferir termômetro, e-mail de recibo e valores de split gravados.
- **Manual, na sandbox:** conferir no dashboard do Pagar.me que o split bateu centavo a centavo com `platformFeeCents` e `netToOrgCents`.
- **Segurança:** script que faz varredura por queries Prisma sem `organizationId` no `where`; teste de XSS no bloco `richText`.
- `pnpm dev` sobe web + worker + docker-compose; seed cria uma ONG demo com campanha publicada.

---

## Próximo passo sugerido

Começar pela **Fase 0 + `fee.ts`**: sem o cálculo de taxa e o isolamento de tenant corretos, todo o resto herda o erro. Posso iniciar criando o monorepo e o schema Prisma completo.
