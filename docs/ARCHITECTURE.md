# Arquitetura e operação

## 1. Objetivo do sistema

O Donation SaaS atende organizações que precisam captar recursos, manter relacionamento com doadores e publicar experiências próprias de doação. A aplicação combina três superfícies no mesmo Next.js:

- site institucional e páginas públicas de cada organização;
- painel autenticado da organização;
- back-office da plataforma.

O processamento assíncrono fica em um worker separado. Postgres é o sistema de registro pretendido, Redis/BullMQ transporta trabalhos assíncronos e um storage compatível com S3 armazena documentos e exportações. Hoje ainda há janelas em que o gateway aceita uma cobrança antes de a `Donation` existir, além de divergência contábil no BYOG; nesses casos o banco não representa toda a realidade externa (`AUD-002`, `AUD-004` e `AUD-014`).

## 2. Estrutura do monorepo

| Área | Responsabilidade |
| --- | --- |
| `apps/web` | Next.js 15, App Router, páginas públicas, painel, admin, APIs, server actions e recebimento de webhooks |
| `apps/worker` | Consumidores BullMQ, recorrência, conciliação, webhooks de saída, e-mails, relatórios e rotinas agendadas |
| `packages/db` | Schema e cliente Prisma, isolamento por organização, criptografia de credenciais e consultas compartilhadas |
| `packages/payments` | Contrato de gateway e adapters Pagar.me, Stripe e mock; cálculo de taxas e split |
| `packages/blocks` | Schemas Zod dos blocos usados pelo page builder |
| `packages/emails` | Templates e envio de e-mails transacionais e de relacionamento |
| `packages/shared` | Dinheiro em centavos, erros de domínio, papéis e cálculo RFM |
| `infra` | Docker Compose local para Postgres, Redis, MinIO e Mailhog |

Ferramentas de workspace: pnpm, Turborepo, TypeScript estrito, Vitest e Prisma.

## 3. Topologia de execução

```text
Navegador / provedor de pagamento
              |
              v
       Next.js (apps/web)
       |       |       |
       |       |       +--> Pagar.me / Stripe / Resend / S3
       |       |
       |       +----------> Redis / BullMQ ----------> Worker
       |                                           |   |   |
       +------------------> Postgres <--------------+   |   +--> e-mail
                                                       +------> webhooks externos
```

O deploy precisa manter `apps/web` e `apps/worker` ativos e apontando para o mesmo banco, Redis, storage e conjunto coerente de segredos.

## 4. Roteamento e multi-tenancy

O middleware decide a superfície pelo host:

| Host | Destino |
| --- | --- |
| domínio-base ou `app.<base>` | `/panel` |
| `admin.<base>` | `/admin` |
| `<slug>.<base>` | `/sites/<host>` |
| domínio próprio verificado | `/sites/<host>` |

Nas páginas públicas, `resolveTenant()` consulta a organização pelo slug ou por `CustomDomain`. Organizações suspensas deixam de resolver como site público.

No painel, `requireOrgAccess()` lê os memberships existentes na sessão e devolve `tenantPrisma(organizationId)`. A intenção arquitetural é que esse cliente injete `organizationId` automaticamente. A implementação atual não cobre todos os modelos e a RLS está incompleta e desligada por padrão; veja `AUD-001`.

## 5. Autenticação e autorização

- Auth.js/NextAuth com sessão JWT.
- Login por credenciais e Google.
- Senhas com bcrypt.
- Verificação de e-mail e redefinição por tokens aleatórios de 32 bytes.
- Back-office controlado por allowlist `PLATFORM_ADMIN_EMAILS`.
- Papéis organizacionais em ordem linear: `OWNER > ADMIN > FINANCE > EDITOR > VIEWER`.

Guards principais:

- `requireUser()` / `requireUserPage()`;
- `requireOrgAccess(orgId, papel)` / `requireOrgAccessPage(...)`;
- `requirePlatformAdmin()` / `requirePlatformAdminPage()`.

Como o modelo de papéis é hierárquico, `FINANCE` também satisfaz qualquer operação que exija `EDITOR`. Essa decisão precisa ser confirmada pelo produto.

## 6. Domínios funcionais

### Organizações, onboarding e KYC

O usuário verificado cria uma organização, informa endereço, representante legal e dados bancários, registra cinco tipos de documento e submete o cadastro. O back-office aprova ou rejeita o KYC. Uma rejeição devolve a organização a `PENDING_KYC`, grava `REJECTED` e permite nova submissão após correção. O registro atual do documento não comprova que o objeto existe no storage; consulte `AUD-011`. O código suporta conta de pagamento gerenciada pela plataforma e conta própria da organização (BYOG/conectada).

### Campanhas e page builder

Cada campanha pertence a uma organização e pode ser `DONATION`, `CROWDFUNDING`, `APADRINHAMENTO` ou `EVENT`. O editor salva rascunho em JSON validado por Zod e publica uma cópia separada. HTML rico é sanitizado no salvamento e novamente na renderização.

### Doações nacionais

O checkout resolve organização e campanha, valida o valor, faz upsert do doador, calcula taxas, cria a cobrança no gateway e persiste uma `Donation`. Pix e boleto normalmente ficam `PENDING`; cartão pode retornar pago de forma síncrona. Confirmações assíncronas entram por webhook e são aplicadas pelo worker.

### Doações internacionais

Stripe Checkout cria uma doação em moeda ISO-4217. O webhook confirma o pagamento. O código registra taxa de plataforma zero e informa que o repasse internacional ainda é manual. Não há política implementada/documentada para prazo e método de repasse, câmbio, taxa efetiva do gateway, conciliação ou responsabilidade contábil; isso permanece uma decisão de produto e operação.

### Recorrência

- Cartão: assinatura no gateway; cada cobrança cria uma nova `Donation`.
- Pix: job diário cria um novo QR para planos vencidos.
- Falhas seguem três tentativas antes do cancelamento local.
- O doador gerencia a recorrência por um token sem autenticação; a organização também pode cancelar pelo painel.

### CRM e comunicação

O CRM mantém doadores, tags, notas, tarefas, segmentos, RFM, modelos de e-mail, broadcasts, automações, status de entrega e preferências. O worker envia campanhas, lembretes, extratos anuais e notificações internas.

### Módulos adicionais

- Apadrinhamento: associa um doador e uma recorrência a um `Sponsee`.
- Rifa: reserva números, recebe pagamento, fecha e sorteia entre tickets pagos.
- Evento: reserva inventário por tipo de ingresso e libera QR para check-in após pagamento.
- Leilão: recebe lances, aplica anti-snipe, cobra o vencedor por Pix e tenta o próximo colocado em caso de inadimplência.
- Links e embaixadores: atribuição de origem, metas e métricas próprias.

## 7. Fluxo de pagamento nacional

```text
POST público
   |
   +--> valida tenant/campanha/valor
   +--> cria ou atualiza doador
   +--> calcula valor, tip e taxa
   +--> chama gateway com chave idempotente
   +--> grava Donation PENDING/PAID/FAILED
                      |
gateway webhook ------+
   |
   +--> valida assinatura
   +--> grava GatewayEvent
   +--> publica job no Redis
              |
              v
       worker atualiza Donation,
       agregados, tickets, recibos
       e webhooks de saída
```

O desenho desejável é uma inbox/outbox durável. Hoje a gravação do evento e a publicação na fila não são atômicas; uma falha do Redis pode deixar um evento persistido que nunca será processado (`AUD-002`).

## 8. Filas e agendamentos

| Fila | Concorrência | Uso |
| --- | ---: | --- |
| `gateway-events` | 5 | Eventos de pagamento |
| `reports` | 2 | Exportações CSV |
| `maintenance` | 1 | RFM, conciliação, recorrência, billing e rotinas periódicas |
| `webhook-delivery` | 10 | Webhooks de saída |
| `emails` | 2 | Broadcasts, resultados e atualizações |

Agendamentos relevantes:

- conciliação de pagamentos: a cada hora;
- Pix recorrente: diariamente às 08:30;
- RFM: diariamente às 03:10;
- billing sweep: diariamente às 06:00;
- encerramento de rifas e lembretes de eventos: de hora em hora;
- liquidação de leilões: a cada cinco minutos;
- broadcasts agendados: a cada cinco minutos.

Os padrões cron usam o fuso do processo do worker. O deploy deve fixar e documentar `TZ`, preferencialmente UTC, e converter horários de negócio explicitamente.

## 9. Modelo de dados

Princípios pretendidos:

- valores monetários como inteiros na menor unidade da moeda;
- relações de domínio associadas a `organizationId`;
- IDs CUID, exceto IDs de doação gerados com UUID em alguns fluxos;
- agregados de campanha e doador atualizados junto com a transição financeira;
- `GatewayEvent` como inbox idempotente;
- `AuditLog` para ações sensíveis.

Grupos principais:

- identidade e tenancy: `User`, `Organization`, `Membership`, `Invitation`, `CustomDomain`;
- produto e cobrança: `Plan`, `Subscription`, `OrganizationPaymentConfig`;
- conteúdo: `Campaign`, `Page`, `PageVersion`, blocos, atualizações, relatórios e recompensas;
- CRM: `Donor`, tags, notas, tarefas, segmentos, broadcasts e logs de e-mail;
- dinheiro: `Donation`, `RecurringPlan`, `Payout`, `GatewayEvent`;
- módulos: `Sponsee`, `Raffle`, `Event`, `Auction` e tabelas filhas;
- integrações: `OutboundWebhook`, `WebhookDelivery`, configuração de e-mail e storage.

Não existe diretório de migrations no snapshot auditado. O schema é válido, mas um ambiente novo não tem uma história versionada reproduzível (`AUD-015`).

`customDomain` nos limites do plano é uma capacidade booleana; `CustomDomain` é o modelo que armazena cada host e sua verificação. Não são duas fontes canônicas do mesmo valor.

## 10. Variáveis de ambiente

Grupos obrigatórios ou condicionais:

| Grupo | Variáveis principais |
| --- | --- |
| Banco e fila | `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `DB_RLS` |
| Auth e hosts | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_BASE_DOMAIN`, credenciais Google |
| Gateway BYOG por organização | `PAYMENTS_ENC_KEY` (credenciais cifradas por organização) |
| Variáveis legadas (não usar em novas conexões) | `PAGARME_SECRET_KEY`, `PAGARME_PUBLIC_KEY`, `PAGARME_WEBHOOK_SECRET`, `PLATFORM_RECIPIENT_ID` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| E-mail | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `EMAIL_SENDING_DOMAIN` |
| Storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` |
| Administração | `PLATFORM_ADMIN_EMAILS` |
| Observabilidade | `SENTRY_DSN` |

O modo de pagamentos suportado é BYOG/`CONNECTED`: cada organização fornece e recebe diretamente no próprio gateway. As variáveis Pagar.me globais acima permanecem apenas para detecção e migração de instalações antigas; o webhook global retorna `410 Gone` quando elas estão configuradas. Novas conexões nunca usam uma conta da plataforma.

No ambiente analisado, Stripe, Resend webhook, S3, Google e Sentry estavam sem configuração. O app consegue iniciar com vários desses recursos desativados, mas o endpoint Resend aceita mensagens sem assinatura quando o segredo está ausente; isso precisa ser corrigido antes de exposição pública.

## 11. Comandos de desenvolvimento

```bash
pnpm install
pnpm infra:up
pnpm db:generate
```

No snapshot auditado, `pnpm db:migrate`/`migrate:deploy` **não reproduzem um banco novo**, porque `packages/db/prisma/migrations` está ausente. É preciso primeiro criar e revisar uma baseline. Somente depois disso o fluxo normal pode continuar com `pnpm db:migrate`, `pnpm db:seed` e `pnpm dev`.

Verificações esperadas:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
# válido somente após versionar a baseline:
pnpm --filter @donation/db migrate:deploy
```

O `lint` ainda não é operacional: falta configuração/dependência ESLint e `next lint` abre um assistente interativo. A CI também não chama `pnpm lint`.

## 12. Observabilidade e operação

O plano original cita Sentry e logs estruturados, porém o código atual usa apenas `console.*` e não inicializa Sentry ou pino. Para pagamentos reais, o mínimo operacional é:

- correlação por `organizationId`, `donationId`, `gatewayEventId` e `jobId`;
- métricas de eventos recebidos, enfileirados, processados, repetidos e em erro;
- alerta para divergência de conciliação, DLQ, recorrência não cancelada e webhook de saída esgotado;
- redaction de PII, credenciais e payloads de gateway;
- runbooks de reprocessamento idempotente;
- backup, restauração testada e política de retenção.

## 13. Estado de qualidade verificado

Em 04/09/2026:

- build de produção do Next.js: aprovado;
- TypeScript `--noEmit` nos sete pacotes/apps: aprovado;
- Prisma schema validate: aprovado, com aviso de configuração que será removida no Prisma 7;
- testes: 20 arquivos e 151 casos aprovados (121 web, 19 payments, 7 blocks, 4 shared; contagem atual após os testes de BYOG);
- lint: não operacional;
- cobertura: não configurada;
- testes de worker, integração com banco/Redis e E2E: ausentes.

Identificação do snapshot verificável sem Git: Node `v24.20.0`, `packageManager` `pnpm@9.12.0` e SHA-256 de `pnpm-lock.yaml` `6F3C42883402CFB0BB686B89EF9D0816815DB18C15903F2D97DCBB43D52B1302`. Não existe commit ou tag para vincular a auditoria.
