# Refinamento de UI/UX — módulo de campanhas

Atualizado em 4 de setembro de 2026. Este documento registra o diagnóstico do
módulo de campanhas e a ordem recomendada para evoluir o produto sem separar o
construtor da experiência pública.

## Escopo analisado

- Lista de campanhas: `app/panel/orgs/[orgId]/campaigns/page.tsx`.
- Criação e configuração: `campaigns/new`, `CampaignForm` e as abas de
  conteúdo, arrecadação, impacto, recompensas, comunicação, links,
  embaixadores e ajustes.
- Construtor visual: `blocks/studio/Studio.tsx`, `Canvas`, `BlockFrame`,
  `Palette`, `Inspector`, `FieldInput`, `ThemePanel` e `PageSettingsPanel`.
- Pré-visualização do rascunho: rota `campaigns/[campaignId]/preview`.
- Renderização compartilhada: `blocks/render.tsx` e `render-static.tsx`.
- Fundação visual e acessibilidade: primitivas em `components/ui` e tokens em
  `app/globals.css`.

## Como funciona hoje

1. A organização cria a campanha e preenche os dados essenciais.
2. A página de configuração organiza os dados de negócio em abas e mostra um
   indicador de preenchimento.
3. O editor visual mantém os blocos em um reducer local, oferece arrastar,
   reordenar, duplicar, remover, undo/redo e autosave.
4. O inspetor edita propriedades do bloco, SEO da página e tema da organização.
5. A prévia renderiza o rascunho com o mesmo renderer da página pública.
6. A publicação é uma ação explícita; a página pública usa os blocos publicados.

## Matriz de configuração dos blocos

Após comparar o registro, o schema, os campos do inspetor e os dois renderers,
todos os tipos possuem entrada na paleta, fábrica de defaults, schema e
renderer. Os casos abaixo receberam correção nesta auditoria:

| Bloco                | Configurações expostas no editor                            | Regra verificada                   |
| -------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Valores sugeridos    | valores, valor livre, índice padrão                         | índice fora da lista é rejeitado   |
| Checkout de doação   | meios de pagamento, recorrência, contribuição extra e texto | meios usam seleção múltipla        |
| Rifa                 | rifa, atalhos de quantidade, escolha de números             | atalhos exigem ao menos um item    |
| Doação internacional | título, moedas, valores sugeridos                           | valores exigem ao menos um item    |
| Depoimentos          | texto, autor, papel e foto                                  | foto opcional disponível no editor |
| Chamada para ação    | título, texto, rótulo, destino e URL                        | destino/URL configuráveis          |

Os blocos de recompensas, mural, relatórios, novidades e ranking exibem dados
da própria campanha; por isso o editor configura título/limite, enquanto os
itens são mantidos nos módulos de negócio correspondentes. Evento, rifa,
leilão e apadrinhamento exigem vínculo com uma entidade existente e são
marcados como incompletos até que o vínculo seja preenchido.

### Regras de consistência verificadas

- O `Block` discriminated union é a fonte de verdade para publicação.
- `PageBlocksDraft` permite edição intermediária sem bloquear o autosave.
- O inspetor valida campos obrigatórios, formato, limites e listas em tempo
  real usando o mesmo schema da publicação.
- O canvas usa os valores configurados nos mocks, em vez de valores fixos,
  para aproximar a prévia do resultado final.
- Ações configuradas como “Abrir uma URL” exigem uma URL válida; não caem
  silenciosamente no checkout.
- Índices, listas de atalhos e valores sugeridos fora dos limites são rejeitados
  antes da publicação.
- IDs duplicados e tipos desconhecidos continuam rejeitados.

## Compartilhamento da campanha

O endereço público agora aparece diretamente na lista de campanhas e na tela
de configurações da campanha, com ações “Abrir página pública” e “Copiar link”.
O endereço é montado como `https://{slug}.{APP_BASE_DOMAIN}/{campaignSlug}` ou
usa o domínio personalizado verificado da organização quando existir. O link é
independente do editor e deve ser o endereço usado em redes sociais, e-mails e
materiais impressos.

## Pontos fortes

- O editor reutiliza o renderer público, reduzindo divergência visual.
- O autosave é debounced e usa proteção contra respostas fora de ordem.
- Existe fallback por bloco para evitar que um bloco inválido derrube o canvas.
- O modelo de blocos é validado por schema e possui mensagens de incompletude.
- A configuração separa conteúdo, captação e comunicação, refletindo o modelo
  mental de uma ONG.
- A base compartilhada já possui foco visível, estados de erro e controles com
  alvo mínimo adequado.

## Achados prioritários

### P1 — segurança e confiança da prévia

Blocos de rifa, evento, leilão, apadrinhamento e doação internacional podem
apontar para fluxos públicos. A prévia agora bloqueia os blocos que poderiam
criar efeitos reais e informa que ações financeiras só funcionam na página
publicada. O checkout de doação já possuía a flag `preview` e continua sendo
renderizado para permitir validar o layout.

Defesa complementar recomendada: endpoints públicos devem rejeitar uma origem
ou metadata de preview caso uma chamada seja forjada fora do navegador.

### P1 — editor móvel

O cabeçalho reunia muitos controles para larguras de 320–428 px e o drawer não
prendia o foco. O cabeçalho foi reorganizado para priorizar publicar, salvar e
abrir os painéis; o drawer ganhou ciclo de Tab, Escape, bloqueio de scroll e
restauração de foco.

### P1 — descoberta e contexto

A prévia não explicava claramente onde o usuário estava nem oferecia retorno
rápido ao editor. Ela agora possui uma barra fixa com campanha, estado de
rascunho, retorno ao editor e ação de edição.

### P2 — edição e responsividade

- O canvas agora informa a largura simulada (desktop ou mobile) e usa padding
  adaptativo.
- O CTA de adicionar bloco tem alvo de toque de 44 px.
- A alça de arrastar e as ações de cada bloco possuem foco visível e alvos
  maiores.
- As abas do inspetor têm `aria-controls`, painel associado, `tabIndex` roving e
  navegação por setas.
- A barra de salvar das abas de configuração fica acessível no rodapé em telas
  pequenas e anuncia sucesso/erro.

## Melhorias recomendadas para a próxima fase

### Construtor

1. Adicionar um modo de zoom (75%, 100%, 125%) e um botão “ver página inteira”.
2. Exibir uma mini árvore/outline dos blocos para páginas longas.
3. Permitir arrastar também por teclado com instrução visível e anúncio da nova
   posição.
4. Adicionar retry explícito ao autosave com fila de alterações pendentes.
5. Mostrar antes da primeira alteração de tema que a cor vale para todas as
   campanhas da organização.
6. Separar `FieldInput` em primitivas, editores de lista e linhas reutilizáveis,
   padronizando labels, erros e responsividade.
7. Oferecer duplicação de campanha como ponto de partida para campanhas
   recorrentes.

### Configuração da campanha

1. Mostrar um resumo persistente com status, URL pública e última publicação.
2. Transformar o indicador de preenchimento em checklist acionável: cada item
   deve explicar por que está pendente e levar à aba correta.
3. Adicionar prévia contextual nas abas de galeria, recompensas e comunicação.
4. Validar slug e URLs com feedback imediato, sem esperar o submit.
5. Para listas extensas (recompensas, links, embaixadores), usar cartões
   empilhados no mobile e tabela somente a partir de `md`.

### Pré-visualização

1. Adicionar alternância de viewport e zoom na barra da prévia.
2. Exibir um painel de “o que ainda falta” quando houver blocos incompletos.
3. Permitir abrir a página pública em nova aba apenas quando a campanha estiver
   publicada, deixando explícito o ambiente de rascunho.
4. Testar a mesma campanha nos estados vazio, incompleto, publicado, pausado e
   encerrado.

## Critérios de aceite

- Em 320 px, nenhum controle do cabeçalho cria overflow horizontal ou fica
  inacessível.
- Tab e Shift+Tab permanecem dentro de drawers e retornam ao botão que os abriu.
- O preview não cria doação, reserva de ingresso, bilhete, lance ou
  apadrinhamento.
- A ação primária (Publicar ou Salvar) permanece visível e informa progresso,
  sucesso e falha.
- Um bloco selecionado é perceptível por cor, borda e foco; a informação não
  depende apenas de cor.
- Uma campanha incompleta identifica o bloco/campo pendente e oferece caminho
  direto para corrigi-lo.
- Typecheck, build e QA visual passam em desktop, tablet e mobile.

## Plano de execução

1. **Fundação (concluída nesta rodada):** cabeçalho móvel, drawer acessível,
   preview seguro, contexto visual, foco e feedback de salvamento.
2. **Instrumentação:** testes de teclado, axe/Lighthouse, snapshots de estados
   e monitoramento de autosave.
3. **Produtividade:** zoom, outline, retry e duplicação de campanha.
4. **Conversão:** otimização da prévia pública, conteúdo guiado e validações
   inline.
