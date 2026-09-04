# Documentação do Donation SaaS

Atualizada em 4 de setembro de 2026 a partir do código existente no workspace.

## Leitura recomendada

1. [Arquitetura e operação](./ARCHITECTURE.md) — componentes, fluxos, dados, filas, integrações e comandos.
2. [Regras de negócio](./BUSINESS-RULES.md) — comportamento implementado, estados, permissões e decisões pendentes.
3. [Auditoria técnica e de segurança](./AUDIT-2026-09-04.md) — falhas confirmadas, riscos, evidências e plano de correção.
4. [Identidade visual](./identidade-visual.md) — referência de marca, tokens, componentes e acessibilidade já existente no projeto.
5. [Plano de monetização](./PLANO-MONETIZACAO.md) — mensalidade fixa, faixas de uso, progressão e requisitos de cobrança.

## Estado resumido

O projeto é um monorepo TypeScript para uma plataforma SaaS multi-tenant de captação de recursos para ONGs. A solução inclui campanhas e páginas públicas, doações nacionais e internacionais, recorrência, CRM, e-mail, rifas, eventos, leilões, apadrinhamento, domínios próprios, webhooks e back-office.

O código está em um estágio de MVP amplo: o build de produção, o schema Prisma, o typecheck e os testes automatizados passaram após o alinhamento BYOG. A descontinuação de `MANAGED`, a taxa transacional fantasma e o upgrade gratuito foram corrigidos; ainda há bloqueadores de produção em isolamento entre organizações, consistência de webhooks, cancelamento de recorrências, inventário de eventos e segurança de integrações. O relatório de auditoria deve ser tratado como parte desta documentação, não como uma lista opcional de melhorias.

## Fontes e precedência

- Estes documentos descrevem o comportamento observado no código em 04/09/2026.
- `README.md` continua sendo o guia rápido de desenvolvimento.
- `PLAN.MD` registra o plano original e contém trechos históricos que já não representam o estado atual.
- `doc.md` registra uma proposta comercial de preços. Há divergências materiais entre essa proposta e o cálculo financeiro implementado; consulte `BUSINESS-RULES.md` e a ocorrência `AUD-004`.
- Em caso de divergência, o código é a fonte do comportamento atual, e as decisões de negócio pendentes precisam ser resolvidas antes de alterar a implementação.

## Limites desta auditoria

- A pasta entregue não contém metadados `.git`; portanto, não foi possível atribuir mudanças, revisar histórico ou confirmar se algum segredo já foi versionado no passado.
- Não foram executados testes contra Pagar.me, Stripe, Resend, Redis, S3 ou um banco real.
- Não houve pentest dinâmico nem revisão jurídica, contábil ou regulatória.
- O arquivo `.env` foi inspecionado apenas por nomes e estado de preenchimento; valores secretos não foram expostos na documentação.
