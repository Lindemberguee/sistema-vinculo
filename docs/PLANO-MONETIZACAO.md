# Plano de monetização por mensalidade

**Status:** direção aprovada; preços e cobrança ainda dependem de validação comercial/financeira
**Data:** 4 de setembro de 2026  
**Escopo:** licença da plataforma para organizações em modo BYOG/`CONNECTED`, sem comissão da plataforma sobre doações

## 1. Resumo da decisão proposta

A plataforma deve cobrar uma mensalidade fixa por faixa de uso, calculada pelo valor mensal efetivamente processado. Este plano se aplica ao modo BYOG/`CONNECTED`, em que a organização usa sua própria conta do gateway. 
As tarifas do Pagar.me permanecem responsabilidade da organização e são descontadas pelo próprio gateway; não devem ser misturadas ao preço da licença.

O valor da mensalidade sobe somente quando o uso se mantém acima do limite por mais de um ciclo. 
Uma campanha excepcional não deve causar mudança imediata de plano.

Essa estrutura combina previsibilidade para a ONG com uma forma proporcional de capturar valor de clientes maiores, sem retirar dinheiro de cada doação nem penalizar organizações pequenas em meses de baixa arrecadação.

## 1.1. Escopo de `CONNECTED`/BYOG e `MANAGED`

O schema ainda possui os modos `CONNECTED` e `MANAGED`, além de `Plan.platformFeeBps`. O modo `MANAGED` permite split em que a plataforma retém percentual; isso é incompatível com a promessa de zero comissão feita neste plano.

Regra vigente após a decisão comercial:

- **BYOG/`CONNECTED`:** modelo principal deste documento; mensalidade fixa; `platformFeeBps` e `platformFeeCents` devem ser zero para a plataforma;
- **`MANAGED`:** descontinuado; não é criado nem aceito pelo fluxo de pagamentos;
- nunca registrar uma taxa percentual em BYOG só porque ela existe no plano cadastrado;
- não apresentar a tabela ao cliente como se a automação de volume, upgrade ou cobrança já estivesse implementada.

A decisão foi tomada: `MANAGED` está descontinuado como oferta. O enum legado permanece apenas para permitir migração segura de registros antigos; o resolver rejeita esse modo, novas conexões gravam sempre `CONNECTED` e o webhook global legado responde `410`. Antes de produção, registros antigos devem ser migrados ou desconectados.

## 2. Princípios comerciais

1. **Sem taxa da plataforma por transação.** A organização recebe o repasse conforme o contrato do Pagar.me, descontadas apenas as tarifas do gateway.
2. **Preço previsível.** O cliente sabe o valor da licença antes de arrecadar.
3. **Escala gradual.** O plano acompanha uso recorrente, não um pico isolado.
4. **Dados não são limitados por plano.** Histórico de doadores, exportação e portabilidade permanecem disponíveis.
5. **Recursos e suporte diferenciam planos.** Não usar apenas arrecadação como justificativa de preço.
6. **Custos realmente variáveis são separados.** SMS, WhatsApp, armazenamento excepcional, implantação assistida e integrações sob medida podem ser cobrados à parte.

## 3. Tabela inicial de preços

| Plano | Volume processado de referência | Mensalidade sugerida | Perfil |
| --- | ---: | ---: | --- |
| Inicial | até R$ 5.000/mês | R$ 99 | ONG começando, suporte por e-mail |
| Essencial | até R$ 20.000/mês | R$ 249 | campanhas e CRM básicos |
| Crescimento | até R$ 60.000/mês | R$ 549 | recorrência, automações e equipe maior |
| Profissional | até R$ 150.000/mês | R$ 999 | operação estruturada e suporte prioritário |
| Escala | até R$ 500.000/mês | R$ 1.799 | maior volume, relatórios e SLA ampliado |
| Enterprise | acima de R$ 500.000/mês | a partir de R$ 2.990 | integrações, multi-CNPJ e atendimento dedicado |

Os valores são uma hipótese inicial, não um preço definitivo. Como referência de posicionamento, a Doare publica mensalidades de R$390, R$650 e R$980, além de taxas transacionais; o OngApp publica R$97/mês mais R$1 por transação. As ofertas têm escopos e custos diferentes, portanto a comparação serve apenas como sinal de mercado ([Doare](https://doare.org/planos), [OngApp](https://ongapp.com.br/)).

### Exemplo do cliente que arrecada R$100 mil

Uma organização que processa R$100.000 em um mês fica no plano Profissional, pagando R$999 de licença. O preço equivale a aproximadamente 1% do volume naquele mês apenas como referência econômica; contratualmente continua sendo uma mensalidade fixa, sem percentual por doação.

Se o cliente atingir R$100 mil apenas em uma campanha anual, deve permanecer no plano anterior até que o uso recorrente justifique a migração conforme as regras da seção 5.

## 4. O que cada plano deve incluir

### Inicial — R$99

- uma campanha ativa;
- checkout Pix, cartão e boleto conforme disponibilidade do gateway;
- CRM básico;
- recibos e exportação;
- até dois usuários;
- suporte por e-mail, com prazo comercial definido.

### Essencial — R$249

- campanhas ativas ampliadas;
- doações recorrentes;
- CRM completo;
- até cinco usuários;
- domínios e personalização padrão;
- suporte prioritário por e-mail.

### Crescimento — R$549

- automações e segmentação;
- embaixadores, eventos ou rifas dentro da política de risco;
- até dez usuários;
- relatórios avançados;
- onboarding remoto incluído.

### Profissional — R$999

- todos os módulos aprovados para produção;
- maior volume de e-mail incluído;
- integrações padrão;
- suporte prioritário por WhatsApp ou canal equivalente;
- revisão trimestral da operação.

### Escala e Enterprise

- limites elevados de equipe e comunicação;
- SLA, integrações, ambientes ou fluxos sob medida;
- gerente de conta e reuniões operacionais;
- condições comerciais negociadas sem alterar a regra de que tarifas do gateway pertencem ao Pagar.me.

Os limites exatos de campanhas, usuários, armazenamento e e-mails devem ser definidos a partir do custo real de infraestrutura e suporte. Não prometer “ilimitado” antes de medir esses custos.

## 5. Regra de medição e mudança de faixa

### Volume elegível

```text
volume elegível = doações pagas
                 - reembolsos
                 - chargebacks
```

Excluir pagamentos pendentes, falhos, expirados, testes, duplicados e doações cadastradas manualmente. Gorjetas devem ser tratadas explicitamente: recomendação inicial é incluí-las no volume porque geram processamento, mas registrar essa decisão no contrato.

### Janela de avaliação

- medir o mês civil encerrado;
- calcular o plano recomendado no primeiro dia útil seguinte;
- subir de faixa somente após dois meses consecutivos acima do limite;
- permitir downgrade após três meses consecutivos abaixo do limite;
- avisar a organização com 30 dias de antecedência;
- nunca cobrar diferença retroativa;
- aplicar 90 dias de carência para clientes novos;
- manter o acesso aos dados durante disputa ou atraso, salvo fraude, inadimplência contratual grave ou obrigação legal.

### Exemplo de progressão

Uma ONG no plano Essencial arrecada R$22 mil em janeiro e R$24 mil em fevereiro. A mudança para Crescimento é comunicada em março e começa na próxima competência prevista no contrato. Se arrecadar R$18 mil em março, não há downgrade imediato; somente três meses consecutivos abaixo de R$20 mil habilitam a revisão para baixo.

## 6. Componentes cobrados separadamente

Manter a mensalidade simples e separar itens cujo custo cresce diretamente com o uso:

- pacote adicional de e-mail marketing;
- SMS, WhatsApp e provedores externos pelo consumo;
- armazenamento acima da franquia;
- migração complexa ou limpeza de base;
- treinamento presencial;
- integração ou desenvolvimento exclusivo;
- SLA e gerente de conta para Enterprise.

Como referência, a Doare publica faixas próprias para disparos de e-mail marketing, em vez de esconder esse custo na taxa de doação ([tabela de e-mail](https://doare.org/docs/email-marketing)).

## 7. Descontos e lançamento

Para os primeiros clientes:

- manter o preço de tabela visível;
- oferecer desconto fundador de 30% por 12 meses, com data de término explícita;
- oferecer 15% de desconto no pagamento anual;
- permitir cancelamento mensal sem multa;
- oferecer teste de 30 dias, sem plano gratuito permanente;
- não conceder descontos diferentes para clientes com o mesmo nível de serviço sem registrar o motivo.

O desconto fundador deve ser tratado como condição temporária, não como novo preço de referência.

## 8. Viabilidade econômica

Antes de publicar a tabela, calcular por plano:

```text
preço mínimo = custo mensal total por cliente / (1 - margem bruta desejada)
```

O custo mensal total deve incluir infraestrutura, banco, storage, e-mail, monitoramento, atendimento, cobrança, incidentes e tempo de onboarding amortizado. Com custo de R$50 e margem bruta alvo de 75%, o preço mínimo seria R$200. Nesse cenário, o plano de R$99 só é sustentável com baixo atendimento manual ou com subsídio deliberado de aquisição.

Indicadores mensais:

- margem bruta por plano;
- custo de infraestrutura por organização;
- horas de suporte por organização;
- taxa de conversão do teste;
- churn de clientes e churn de receita;
- expansão e downgrade;
- arrecadação mediana e distribuição por faixa;
- inadimplência da mensalidade;
- custo de e-mail, storage e integrações;
- payback de aquisição.

## 9. Requisitos para implementar a cobrança

O que segue é trabalho de uma segunda fase de produto. A proteção contra upgrade gratuito e a remoção da taxa fantasma já foram aplicadas: mudanças self-service ficam bloqueadas até existir cobrança confirmada e todos os fluxos de doação calculam taxa da plataforma igual a zero. Ainda não existe ledger mensal de volume, histerese automática nem assinatura de mensalidade separada. A ordem segura continua sendo validar o preço com clientes antes de automatizar.

### Dados e domínio

- criar um ledger mensal de uso por organização;
- armazenar bruto pago, reembolsos, chargebacks, volume elegível e origem dos eventos;
- fechar o período de uso de forma idempotente;
- manter histórico de mudanças de plano e motivo;
- separar `platformFeeCents` de qualquer valor de gateway: com este modelo, a taxa transacional da plataforma deve ser zero;
- definir moeda, impostos, nota fiscal, vencimento, tolerância e cancelamento.

### Cobrança

- usar assinatura de mensalidade separada das cobranças de doação;
- usar chave idempotente por organização e competência;
- tratar falha de cartão, Pix ou boleto sem bloquear dados imediatamente;
- oferecer fatura e comprovante;
- registrar upgrade, downgrade, desconto, crédito e estorno;
- proteger as ações de billing com autorização de owner/admin e trilha de auditoria.

### Painel da organização

Exibir volume do período, faixa atual, próxima faixa, regra de cálculo, data da próxima revisão, valor da mensalidade e itens variáveis. O cliente deve conseguir exportar o detalhamento que originou a cobrança.

## 10. Aceitação do modelo

O modelo estará pronto para piloto quando:

1. uma organização pequena conseguir prever sua mensalidade sem conhecer o código;
2. uma campanha excepcional não provocar upgrade imediato;
3. dois meses acima do limite provocarem uma única mudança idempotente;
4. reembolso e chargeback reduzirem o volume elegível no período correto;
5. o cliente puder auditar a composição do volume;
6. nenhuma doação tiver percentual da plataforma retido;
7. a tarifa do Pagar.me aparecer separada da licença;
8. falha de cobrança da mensalidade não apagar histórico nem impedir exportação;
9. o preço de cada plano cobrir o custo-alvo ou tiver subsídio aprovado;
10. contrato, tela de preços e fatura usarem a mesma definição de volume.

## 11. Decisões pendentes

1. A tabela inicial será R$99/R$249/R$549/R$999/R$1.799 ou terá outra âncora?
2. Gorjeta entra no volume elegível?
3. Qual é a franquia de e-mail por plano?
4. Quais módulos exigem aprovação de risco antes de serem liberados?
5. Qual prazo de suporte cada plano promete?
6. Qual margem bruta mínima é necessária?
7. A mensalidade terá reajuste anual por índice ou revisão contratual?
8. O que acontece com a organização inadimplente: somente modo leitura, suspensão de novas campanhas ou outra política?
9. Qual entidade emitirá nota fiscal e como será tratado o imposto?
10. A cobrança da licença será feita pelo próprio Pagar.me ou por outro provedor?
11. (Decidido) O modo `MANAGED` foi descontinuado; novas conexões são exclusivamente `CONNECTED`/BYOG.

## 12. Ordem de implantação

### Fase 1 — Validação comercial

- entrevistar 5–10 organizações de portes diferentes;
- apresentar a tabela sem negociar durante a primeira conversa;
- medir disposição de pagamento, recursos indispensáveis e sazonalidade;
- escolher 2–3 clientes-piloto.
- registrar a decisão de descontinuação de `MANAGED` no contrato, onboarding e materiais comerciais;
- confirmar com contabilidade/contrato que BYOG não terá `platformFeeBps` nem `platformFeeCents`.

### Fase 2 — Instrumentação

- implementar ledger de volume e relatório mensal;
- medir custos reais por organização;
- validar tratamento de reembolso, chargeback e gorjeta;
- publicar contrato e política de mudança de faixa.

### Fase 3 — Cobrança piloto

- faturar manualmente ou com automação simples por três competências;
- acompanhar suporte, inadimplência e divergências;
- manter revisão humana para qualquer mudança de faixa;
- corrigir o modelo antes de liberar self-service.

### Fase 4 — Automação

- automatizar assinatura, fatura, retries e notificações;
- adicionar aprovação de upgrade/downgrade e trilha de auditoria;
- liberar painel de uso e exportação;
- revisar preços trimestralmente com dados observados.

## 13. Relação com a auditoria técnica

Este plano substitui a ideia anterior de taxa transacional da plataforma. A implementação corrigiu as divergências apontadas em `AUD-004` e `AUD-005` do [relatório de auditoria](./AUDIT-2026-09-04.md): no BYOG, `platformFeeCents` é sempre zero e a troca de plano não é aplicada sem confirmação da mensalidade.

O plano não autoriza implementar imediatamente ledger, histerese ou cobrança automática. Esses itens só devem começar depois da validação comercial da Fase 1 e da definição do provedor de cobrança recorrente.

Este documento é uma proposta de produto e não substitui validação contábil, tributária, contratual ou jurídica.
