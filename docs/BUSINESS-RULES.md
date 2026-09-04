# Regras de negócio

Este documento separa três coisas que antes estavam misturadas: comportamento implementado, intenção declarada nos documentos antigos e decisões ainda não fechadas. Regras marcadas como “observadas” descrevem o código de 04/09/2026, mesmo quando o relatório de auditoria recomenda alterá-las.

## 1. Organizações e acesso

### Estados da organização

| Estado | Comportamento observado |
| --- | --- |
| `PENDING_KYC` | Organização em onboarding; não pode receber pagamentos |
| `ACTIVE` | Site público e checkouts habilitados, desde que haja gateway conectado |
| `SUSPENDED` | Não resolve como site público e não pode receber pagamentos |

O onboarding exige conta com e-mail verificado para criar uma organização. O fluxo coleta CNPJ, endereço, representante legal, conta bancária e cinco documentos. A aprovação do KYC pode ativar a organização.

O KYC segue `NOT_STARTED -> SUBMITTED -> IN_REVIEW -> APPROVED`. A rejeição grava `kycStatus: REJECTED`, devolve a organização a `PENDING_KYC` e preserva um motivo de até 500 caracteres. O fluxo de submissão não restringe o estado anterior, portanto a organização pode corrigir dados/documentos e reenviar. “Documento enviado” significa, hoje, apenas que um registro com `storageKey` foi aceito; a implementação ainda não comprova a existência ou o vínculo do objeto no storage (`AUD-011`).

### Papéis

O código implementa uma hierarquia cumulativa:

| Papel | Nível | Efeito observado |
| --- | ---: | --- |
| `OWNER` | 5 | Todas as ações, inclusive plano, equipe e KYC |
| `ADMIN` | 4 | Administração da organização, pagamentos e integrações |
| `FINANCE` | 3 | Finanças e também tudo que exige `EDITOR` |
| `EDITOR` | 2 | Campanhas, CRM e módulos operacionais |
| `VIEWER` | 1 | Leitura |

Ponto de decisão: confirmar se `FINANCE` deve herdar edição de conteúdo, sorteio de rifa, operação de evento e CRM. Se as funções forem independentes, substituir o ranking linear por permissões/capacidades.

### Sessões

Memberships e papéis são copiados para o JWT no login e em uma atualização explícita da sessão. Remoção ou rebaixamento no banco não revoga imediatamente uma sessão já emitida. A regra recomendada é revalidar membership em operações sensíveis ou versionar/revogar sessões.

## 2. Planos e cobrança da plataforma

### Planos semeados

| Plano | Mensalidade | Taxa configurada | Campanhas | Usuários | Módulos |
| --- | ---: | ---: | ---: | ---: | --- |
| Inicial | R$ 99 | 0% | 1 | 2 | núcleo |
| Essencial | R$ 249 | 0% | ilimitadas | 5 | CRM |
| Crescimento | R$ 549 | 0% | ilimitadas | 10 | todos os módulos listados |
| Profissional | R$ 999 | 0% | ilimitadas | 25 | todos os módulos listados |
| Escala | R$ 1.799 | 0% | ilimitadas | 50 | todos os módulos listados |
| Enterprise | a partir de R$ 2.990 | 0% | ilimitadas | ilimitados | todos |

Esses valores vêm do seed atualizado conforme a proposta em `PLANO-MONETIZACAO.md`. `doc.md` ainda contém a proposta histórica de BYOG com mensalidade de R$ 600–800; não é fonte vigente.

### Limites implementados

- núcleo de campanha/doação sempre disponível;
- `maxCampaigns` verificado antes de criar campanha;
- `maxUsers` considera membros e convites pendentes;
- direito a domínio próprio verificado pela chave booleana `customDomain` nos limites do plano; os hosts configurados são registros `CustomDomain` separados;
- módulos declarados: `crm`, `raffles`, `events`, `auctions`, `sponsees`, `links`, `ambassadors`, `intl`.

### Lacunas observadas

- A troca self-service de plano está bloqueada até existir cobrança confirmada da licença (`AUD-005`).
- A cobrança mensal automática está declarada como futura no próprio código.
- O status/período da `Subscription` não participa de `getOrgLimits()`.
- Vários módulos só são escondidos na UI ou protegidos em algumas ações; CRM, links, embaixadores e internacional não têm guard central consistente.
- Downgrade só bloqueia excesso de usuários. Campanhas, domínios e recursos de módulos existentes não são tratados.
- Contagens de quota não são reservadas atomicamente; requisições concorrentes podem ultrapassar limites.

Regra recomendada: uma camada única de entitlement no servidor deve combinar plano, assinatura, período de tolerância, módulo e quota, independentemente da UI.

## 3. Campanhas e publicação

### Tipos e estados

Tipos: `DONATION`, `CROWDFUNDING`, `APADRINHAMENTO` e `EVENT`.

```text
DRAFT --publishCampaign()--> PUBLISHED
qualquer estado existente --setCampaignStatus()--> PAUSED | PUBLISHED | CLOSED
```

`publishCampaign()` publica o snapshot do rascunho. Já `setCampaignStatus()` não valida o estado de origem: inclusive uma campanha `CLOSED` pode voltar a `PUBLISHED` ou `PAUSED`. É preciso decidir se encerramento é terminal e formalizar a matriz de transições. Uma campanha só recebe doações quando está `PUBLISHED` e a organização está `ACTIVE`.

### Conteúdo

- `blocks` é o rascunho do page builder.
- `publishedBlocks` é a versão pública.
- Blocos são validados com Zod.
- HTML rico é sanitizado antes de salvar/publicar e na renderização.
- Slug é único por organização.
- Valor mínimo, recorrência, gorjeta, dedicatória, recompensas, links e embaixadores são opções configuráveis.

### Agregados

`raisedCents` soma o valor-base das doações pagas, sem a gorjeta. `donorsCount` é incrementado por doação paga e por ciclo recorrente, não por doador único. Apesar do nome, o comportamento atual é “quantidade de pagamentos”. Confirmar se o indicador comercial desejado é pagamentos, doadores únicos ou ambos.

## 4. Doador e consentimento

O doador é deduplicado por `(organizationId, email)`. O checkout pode atualizar nome, telefone, hash do documento e o JSON de consentimento antes da confirmação do pagamento.

Regras observadas:

- CPF/CNPJ bruto do checkout não é persistido; apenas SHA-256 normalizado.
- consentimento guarda somente o estado mais recente, data, origem e IP;
- uma nova tentativa pública de checkout pode sobrescrever cadastro e consentimento existentes;
- reembolso reduz totais e contagem, mas não recompõe `firstDonationAt` e `lastDonationAt`;
- RFM usa os agregados e datas mantidos no doador.

Regras recomendadas:

- separar “identidade declarada no checkout” do perfil mestre do CRM;
- atualizar perfil mestre apenas após pagamento ou confirmação do e-mail;
- registrar consentimento em tabela append-only, com finalidade, texto/versão e origem;
- nunca transformar uma marcação pública não verificada em opt-in válido;
- usar HMAC com segredo para identificadores deduplicáveis sensíveis;
- definir retenção, anonimização, portabilidade e exclusão compatíveis com a política jurídica da empresa.

## 5. Valores, taxas e gateway

### Unidade monetária

Valores nacionais são inteiros em centavos. Doações internacionais também usam `amountCents`, mas o campo representa a unidade menor da moeda indicada em `currency`.

### Fórmula implementada

```text
chargeTotal = amount + tip
platformFee = ceil(amount * platformFeeBps / 10.000) + fixedFee
netToOrg    = chargeTotal - platformFee
orgFeeBorne = max(0, platformFee - tip)
```

Há invariantes para impedir líquido não positivo e garantir que as pernas do split conciliem com o total.
Essa fórmula permanece apenas como helper compatível com dados legados. Em produção, todos os planos BYOG usam `platformFeeBps = 0`, `platformFeeFixedCents = 0` e split vazio; a tarifa cobrada pelo gateway não é receita da plataforma.

### Modos de pagamento

| Modo | Conta do gateway | Split |
| --- | --- | --- |
| `CONNECTED` / BYOG | Conta própria da organização | vazio |
| `MANAGED` | — | descontinuado |

O modo `MANAGED` foi descontinuado. No modo conectado, o gateway recebe split vazio e deposita o valor na conta da organização. O código calcula `platformFeeCents = 0` e `netToOrgCents = amountCents + tipCents`; a tarifa do gateway continua fora do ledger da plataforma. A monetização da plataforma é a mensalidade.

## 6. Máquina de estados da doação

Intenção declarada:

```text
CREATED -> PENDING -> PAID -> REFUNDED
                    |       -> CHARGED_BACK
                    -> FAILED
CREATED/PENDING -> EXPIRED
FAILED -> PENDING (nova tentativa)
```

Regras de agregação pretendidas:

- entrada em `PAID`: incrementa campanha, doador, link, embaixador, recompensa e libera bens/ingressos;
- saída de `PAID`: decrementa os mesmos agregados e desfaz itens associados;
- tudo dentro de transação de banco;
- webhook idempotente por `GatewayEvent.id` e cobrança por `gatewayChargeId` único.

Comportamento efetivo do worker:

- `markChargeStatus()` só muda `CREATED` ou `PENDING` para o estado recebido;
- `reverseCharge()` só aceita uma doação atualmente `PAID` e sempre estorna o valor integral;
- reembolso parcial não é representado;
- `markChargePaid()` aceita qualquer estado diferente de `PAID`, inclusive estados terminais.

O arquivo de máquina de estados existe, mas o worker não o usa. Assim, um evento atrasado pode ressuscitar `REFUNDED` ou `CHARGED_BACK`. Toda mutação financeira deve usar transição condicional atômica e rejeitar ordem inválida.

## 7. Webhooks e conciliação

### Entrada

- Pagar.me BYOG: cada organização configura sua própria conta e segredo; não há autenticação global para novas conexões.
- Pagar.me conectado: endpoint por organização e segredo próprio.
- Stripe: assinatura oficial do webhook.
- Resend: assinatura Svix quando o segredo está configurado.

O evento Pagar.me é persistido e depois enfileirado. A duplicata é respondida sem reenfileirar. Assim, se Redis falhar após o insert, a próxima tentativa do provedor é descartada como duplicada. A inbox precisa expor estados como `RECEIVED`, `QUEUED`, `PROCESSING`, `PROCESSED`, com um dispatcher/reconciliador durável.

### Conciliação

De hora em hora, doações `PENDING` entre 15 minutos e sete dias são consultadas no gateway. O job também limpa reservas antigas.

Lacunas:

- doação que nunca chegou a ser persistida não entra na conciliação;
- cobrança recorrente perdida antes de vincular `gatewaySubscriptionId` não é recuperada;
- eventos marcados como processados sem entidade correspondente não são revisitados;
- não há painel/DLQ operacional nem alerta estruturado.

## 8. Recorrência

### Estados e dunning

```text
ACTIVE -> PAST_DUE -> CANCELED
```

Após três falhas, o plano é cancelado. No cartão, o código tenta cancelar no gateway; no Pix, o próprio worker cria QR codes mensais.

Problemas observados:

- cancelamento no gateway pode falhar e ser ignorado; mesmo assim o plano local vira `CANCELED` e o usuário recebe confirmação;
- uma cobrança posterior de cartão aceita plano cancelado e o reativa como `ACTIVE`;
- criação da recorrência ocorre antes de a operação externa terminar; falha pode deixar plano `ACTIVE` sem assinatura ou Pix inicial;
- apadrinhamento Pix pode ficar reservado mesmo após erro de criação da cobrança;
- `addInterval()` usa `Date.setMonth`, fazendo 31 de janeiro avançar para março em alguns anos.

Regra recomendada: introduzir estados `CREATING`, `ACTIVE`, `PAST_DUE`, `CANCEL_PENDING`, `CANCELED`, registrar cada comando externo com idempotência e só confirmar cancelamento após resposta/webhook do gateway.

## 9. Apadrinhamento

Uma seleção de apadrinhamento força recorrência mensal e aceita Pix ou cartão. O afilhado é associado ao doador da recorrência e volta a `AVAILABLE` quando o plano termina.

O código atual aceita selecionar um afilhado já `SPONSORED` e sobrescreve o patrocinador. A reserva também não testa atomicamente o resultado do update. A regra correta precisa ser:

- somente `AVAILABLE` pode ser reservado;
- claim condicional atômico com `count === 1`;
- claim e criação da recorrência na mesma unidade de consistência local;
- compensação segura se a operação no gateway falhar;
- política explícita para troca de patrocinador e pagamentos atrasados.

## 10. Recompensas

Uma recompensa pode exigir valor mínimo e quantidade máxima. A checagem de estoque e o incremento de `claimed` acontecem em momentos diferentes, sem reserva atômica. Checkouts concorrentes podem vender além da quantidade.

Definir estados de reserva, expiração e confirmação, ou usar update condicional dentro de transação antes de abrir o pagamento. O prazo precisa respeitar o método de pagamento.

## 11. Rifas

Estados:

```text
DRAFT -> OPEN -> CLOSED -> DRAWN
   |       |        |
   +-------+--------+-> CANCELED
```

Números possuem unicidade `(raffleId, number)`, o que protege a corrida de reserva. Somente tickets `PAID` participam do sorteio.

O resultado atual é `sha256(seed) mod quantidade`, aplicado à lista ordenada de tickets. Isso é reproduzível, mas não imparcial: o operador escolhe a seed depois de conhecer a lista e consegue testar seeds até selecionar qualquer índice. Uma solução auditável exige compromisso prévio da seed, fonte pública de entropia posterior ao fechamento ou serviço de aleatoriedade verificável.

Boleto fica válido por três dias, mas a reserva é limpa após 24 horas. Um pagamento no segundo ou terceiro dia pode ser confirmado sem o número originalmente comprado.

A operação de rifa e sua mecânica também exigem validação jurídica separada antes de lançamento.

## 12. Eventos

O estoque é controlado por `EventTicketType.sold`, que inclui reservas e ingressos confirmados. A reserva usa update condicional e cria tickets na mesma transação.

Há um erro confirmado na compensação: quando a transação falha, o banco já desfaz os incrementos, mas o catch decrementa `sold` novamente. O contador pode ficar abaixo do real e permitir overselling.

Outras regras:

- pagamento confirma `RESERVED -> VALID`;
- check-in faz `VALID -> USED`;
- reembolso marca `REFUNDED` e devolve capacidade;
- Pix dura uma hora; boleto três dias; a limpeza genérica de reservas ocorre em 24 horas.

## 13. Leilões

Estados da disputa: `DRAFT`, `OPEN`, `ENDED`, `SETTLED`, `CANCELED`. Lotes: `ACTIVE`, `SOLD`, `UNSOLD`.

- O lance mínimo é preço inicial ou lance atual + incremento.
- Update condicional no valor atual funciona como lock otimista.
- Lance dentro da janela anti-snipe estende o fim.
- O vencedor recebe cobrança Pix de cinco dias.
- Após inadimplência, até dois próximos colocados podem ser tentados.

Lacunas:

- identidade do licitante não é verificada; qualquer pessoa pode licitar com e-mail de terceiro;
- não há depósito, pré-autorização ou limite acumulado contra abuso;
- o lote vira `SOLD` antes da cobrança; se a cobrança falha antes de criar `donationId`, o job de cobrança posterior nunca o seleciona;
- workers concorrentes podem liquidar o mesmo lote sem claim atômico;
- cobrança criada no gateway antes de falha local pode ficar órfã.

## 14. Eventos de saída e integrações

Webhooks de saída são assinados com HMAC-SHA256 e repetidos pelo BullMQ. A organização informa qualquer URL HTTPS.

Regra de segurança necessária: bloquear destinos privados, loopback, link-local, redes reservadas, redirects e DNS rebinding; idealmente usar egress proxy e allowlist por IP resolvido. A validação atual de apenas `https://` não impede SSRF.

## 15. Decisões obrigatórias antes das próximas mudanças

1. O modelo comercial definitivo por modo de gateway e plano.
2. O significado de `donorsCount` e dos indicadores financeiros.
3. A matriz de capacidades por papel.
4. O efeito de inadimplência e downgrade nos recursos existentes.
5. A política de cancelamento quando o gateway está indisponível.
6. A validade de boleto para rifas e eventos com estoque escasso.
7. A mecânica imparcial e a aprovação jurídica de rifas.
8. A garantia de identidade/compromisso em leilões.
9. A política LGPD: consentimento, retenção, exportação, anonimização e exclusão.
10. A política de criptografia e acesso para CPF, banco e documentos KYC.
11. O SLA de webhooks, conciliação, reprocessamento e comunicação de incidentes.
12. O fuso horário oficial de jobs e datas de negócio.
13. Se `CLOSED` é estado terminal de campanha e quem pode reabrir.
14. Se haverá reembolso parcial e como valores, taxas, inventário e agregados serão revertidos.
15. A política da operação internacional: prazo e método de repasse, câmbio, taxas, conciliação, responsabilidade contábil e SLA.
