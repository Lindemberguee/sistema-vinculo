# Plano de refinamento UI/UX

## Objetivo

Criar uma experiência única para o painel da organização: clara para tarefas
operacionais, consistente entre módulos, responsiva e acessível. O refinamento
preserva as regras de negócio e concentra decisões visuais em componentes
compartilhados.

## Direção visual

- Verde institucional como ação primária; estados semânticos não dependem só de cor.
- Tipografia com escala nomeada (`text-title`, `text-heading`, `text-ui` e `text-caption`).
- Cartões para agrupar contexto; tabelas para comparação e operação em lote.
- Espaçamento previsível, controles com alvo mínimo de 40–44px e foco visível.
- Estados completos: carregando, vazio, erro, sucesso, desabilitado e sem permissão.
- Mobile reorganiza a informação; não apenas reduz a largura do desktop.

## Fundação compartilhada

As primitivas em `apps/web/src/components/ui` são a fonte de verdade para:

- cabeçalho de página, ações e navegação de retorno;
- botões, campos, validação e estados de carregamento;
- cartões, resumos, badges e status de domínio;
- tabelas com rolagem horizontal controlada e cabeçalhos legíveis.

O shell do painel (`PanelChrome` e `PanelSidebar`) concentra navegação, tema,
menu mobile, breadcrumb e atalho para o conteúdo.

## Ordem de execução

1. **Fundação** — tokens, primitivas, shell e acessibilidade transversal.
2. **Operação diária** — painel, campanhas, doadores, tarefas e finanças.
3. **Captação** — eventos, rifas, leilões e seus fluxos públicos.
4. **Relacionamento** — comunicação, automações e apadrinhamento.
5. **Conta e administração** — pagamentos, equipe, configurações, domínios e exportações.
6. **QA visual** — validação em desktop, tablet e mobile, incluindo estados extremos.

## Critérios de aceite

- A ação primária é identificável em até um olhar e não compete com ações secundárias.
- Toda página possui título, contexto, estado vazio e feedback de erro acionável.
- Formulários têm labels, descrição/erro associados e foco visível.
- Tabelas não quebram o layout em telas pequenas e mantêm leitura por coluna.
- Navegação por teclado alcança todos os controles e respeita a ordem visual.
- Cores e status continuam compreensíveis em tema claro, escuro e sem percepção de cor.
- Mudanças passam por typecheck, build e inspeção visual antes do merge.

## Pendências de produto

- Validar com usuários reais a nomenclatura dos módulos e ações principais.
- Definir quais módulos devem aparecer bloqueados por plano e qual mensagem orientar.
- Capturar screenshots de referência após cada fase para evitar regressões visuais.
