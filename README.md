# donation-saas

> Documentação técnica atual: [`docs/INDEX.md`](docs/INDEX.md). A auditoria de 04/09/2026 identificou bloqueadores que precisam ser resolvidos antes de operar pagamentos reais em produção.

SaaS multi-tenant de doações para ONGs. Cada organização faz onboarding + KYC,
cria campanhas com páginas montadas em um **page builder por blocos**, e recebe
doações (avulsas e recorrentes) via **Pagar.me v5 com split automático** — a
plataforma retém sua taxa na própria transação.

Plano completo: `.claude/plans/chat-estou-querendo-criar-composed-mccarthy.md`.

## Stack

- **apps/web** — Next.js 15 (App Router): site institucional, painel da ONG
  (`app.<domínio>`), back-office (`admin.<domínio>`) e páginas públicas
  (`<slug>.<domínio>` + domínio próprio).
- **apps/worker** — Node + BullMQ: processa webhooks, e-mails, recorrência e relatórios.
- **packages/db** — Prisma schema + client + `tenantPrisma()` (isolamento por `organizationId`).
- **packages/payments** — abstração de gateway + `calculateFees()` + adapter Pagar.me.
- **packages/blocks** — schema Zod dos blocos + registry do builder.
- **packages/emails** — templates transacionais.
- **packages/shared** — money (centavos), erros, roles.

## Setup

```bash
pnpm install
cp env.example .env          # preencha as chaves
pnpm infra:up                # postgres + redis + minio + mailhog via Docker
# cria o bucket privado de uploads no MinIO (uma vez):
docker run --rm --network host minio/mc sh -c "mc alias set l http://localhost:9000 minioadmin minioadmin && mc mb -p l/donation-uploads"
pnpm db:migrate              # cria o schema
pnpm db:seed                 # ONG demo + campanha publicada + usuário owner
pnpm dev                     # web (:3000) + worker
```

Hosts locais (`*.localhost` já resolve no Chrome/Edge):

- Painel: <http://app.localhost:3000>
- Back-office (KYC): <http://admin.localhost:3000> — e-mail precisa estar em `PLATFORM_ADMIN_EMAILS`
- Site da ONG demo: <http://instituto-demo.localhost:3000/agua-limpa>

## Testes

```bash
pnpm test          # unit (fee.ts, block schema, ...)
```

## Convenções

- **Dinheiro é sempre `Int` em centavos.** Use os helpers de `@donation/shared`.
- **Nunca** consulte o banco sem `organizationId` — use `tenantPrisma(orgId)`.
- Taxas se calculam **só** em `calculateFees()` no servidor; nunca confie no cliente.
- Confirmação de pagamento **só via webhook**, nunca na resposta do checkout.

## Recorrência

- **Cartão** → assinatura no Pagar.me; cada ciclo chega por `subscription.charged` e vira uma `Donation`. Falhas seguem régua de dunning (3 tentativas → `PAST_DUE` → `CANCELED`).
- **Pix** → job diário (`pix-recurring`) gera um QR novo e envia por e-mail; a confirmação vem pelo webhook normal e avança o plano.
- Doador gerencia/cancela em `app.<domínio>/r/<cancelToken>` (link nos e-mails). A ONG cancela na tela do doador.

## Domínio próprio

Plano Pro. Em `Configurações → Integrações → Domínio próprio`: aponte um `CNAME` para `cname.<APP_BASE_DOMAIN>` (ou um `TXT` em `_donation-verify.<host>`), clique **Verificar**. SSL é emitido pelo edge/proxy (Vercel Domains API ou Caddy on-demand TLS).

## Webhooks de saída

`Configurações → Integrações → Webhooks`. Eventos: `donation.paid`, `donation.refunded`, `recurring.charged`, `recurring.canceled`, `campaign.published`, `kyc.approved`. Cada POST leva `X-Webhook-Signature: sha256=HMAC(secret, body)`; retries com backoff, histórico em `WebhookDelivery`.

## RLS (isolamento no banco)

Segunda camada além do `tenantPrisma`. Para ligar:
1. `psql "$DATABASE_URL" -f packages/db/sql/rls.sql`
2. Provisione um papel/URL de sistema com `BYPASSRLS` para o worker e as rotas de sistema (webhook Pagar.me, páginas públicas) — ainda pendente de fiação.
3. `DB_RLS=on` no app e no worker.

## Fases

Ver o plano. Fases 0–5 implementadas.
