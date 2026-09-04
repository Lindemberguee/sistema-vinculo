# Identidade visual — plataforma de doações multi-tenant

> Documento de estratégia e sistema de design. Não contém código de produção; descreve o
> destino e um caminho de migração em fases a partir do que já existe no monorepo.
> Escopo: as três superfícies do produto (painel da ONG, sites públicos das ONGs, e-mails
> transacionais) e o modelo de tema por inquilino.

---

## Resumo executivo (para leitura rápida)

A plataforma já tem um sistema visual coerente e maduro — verde institucional (`#006B4F`),
neutros quentes, tipografia Inter, hairlines em vez de sombras, componentes reutilizáveis em
`apps/web/src/components/ui` e tokens Tailwind v4 em `apps/web/src/app/globals.css`. O que
falta não é redesenhar, e sim **consolidar**: (1) transformar os tokens em fonte única que os
e-mails e o worker também consomem, hoje eles repetem hex à mão; (2) separar com clareza a
**identidade da plataforma** (fixa) do **tema do inquilino** (uma cor de acento + raio de
botão + logo), com um guarda-corpo de contraste real em vez do teste de luminância atual;
(3) fechar lacunas de acessibilidade pontuais (rótulos só-placeholder no login, texto de
pílula com contraste ~3,9:1, ausência de `prefers-reduced-motion`); (4) dar nomes semânticos
à escala tipográfica e aos tokens de movimento/elevação/z-index que hoje são valores soltos.
A marca (nome e logo) ainda não existe — este documento entrega um **framework** de naming,
direção de logotipo e voz, e recomenda **não** decidir o nome agora, mas já preparar o
sistema para receber qualquer marca sem retrabalho. Modo escuro: não agora; os tokens ficam
"prontos para escuro" para que seja uma adição, não uma reescrita. O roadmap é em 6 fases
independentes, cada uma entregável sem big-bang, começando pela fundação de tokens.

---

## Sumário

1. [Princípios de marca](#1-princípios-de-marca)
2. [Fundações de token](#2-fundações-de-token)
3. [Tipografia](#3-tipografia)
4. [Sistema de componentes](#4-sistema-de-componentes)
5. [Consistência entre as três superfícies](#5-consistência-entre-as-três-superfícies)
6. [Theming por inquilino](#6-theming-por-inquilino-multi-tenant)
7. [Data-viz](#7-data-viz)
8. [Iconografia e imagística](#8-iconografia-e-imagística)
9. [Motion](#9-motion)
10. [Modo escuro](#10-modo-escuro)
11. [Acessibilidade](#11-acessibilidade)
12. [Governança e entrega](#12-governança-e-entrega)
13. [Não-objetivos](#13-não-objetivos)
14. [Arquivos por fase](#14-arquivos-concretos-por-fase)

---

## 1. Princípios de marca

### 1.1 O que o produto é

Infraestrutura de arrecadação para organizações brasileiras do terceiro setor. A ONG cria
páginas de campanha, recebe doações avulsas e recorrentes (Pix, cartão, boleto), e gerencia
doadores. O público direto são **gestores de captação e financeiro de ONGs** (painel); o
público indireto são **doadores brasileiros** (sites públicos e e-mails).

### 1.2 Personalidade

| Eixo | Onde fica a plataforma |
| --- | --- |
| Institucional ↔ Casual | **Institucional-acessível.** Sóbria como um banco, calorosa como uma ONG. |
| Neutra ↔ Expressiva | **Neutra por escolha.** A cor e a voz fortes pertencem à ONG, não a nós. |
| Densa ↔ Espaçada | Painel **denso e funcional**; páginas públicas **espaçadas e editoriais**. |
| Decorada ↔ Estrutural | **Estrutural.** Hairline, tabela, número alinhado — nada de ornamento. |

Três palavras-guia: **confiável, discreta, precisa.**

### 1.3 Tom de voz (pt-BR)

- **Segunda pessoa, verbo no presente, frase curta.** "Confirme seu e-mail", não "É
  necessário que você confirme".
- **O rótulo diz o que acontece.** "Publicar campanha" produz o toast "Campanha publicada".
  O verbo do botão é o verbo da confirmação. (Regra já seguida em `StatusBadge`/`PageHeader`;
  formalizar.)
- **Erro explica a recuperação, sem pedir desculpas e sem culpar.** "Use um código hex de 6
  dígitos (ex.: #006B4F)" — exatamente o padrão do `ThemePanel.tsx`. Generalizar.
- **Estado vazio é convite.** "Nenhuma campanha ainda. Crie a primeira." (padrão já usado em
  `campaigns/page.tsx`).
- **Números por extenso quando ajudam a confiança.** "23 pessoas já doaram", "R$ 1.240
  arrecadados". Moeda e percentual sempre em pt-BR (`formatBRL`, vírgula decimal).
- **Sobriedade emocional.** Um 💚 no e-mail de agradecimento é aceitável; três não. Nada de
  "Uhuul!", "Incrível!", exclamação em série.

### 1.4 O que NÃO somos

- Não somos uma marca de "movimento" com manifesto, gradiente e tipografia gritada.
- Não competimos por atenção com a ONG na página pública — nossa presença ali é um rodapé.
- Não usamos linguagem de startup ("plataforma disruptiva", "engajamento", "jornada").
- Não somos um criador de sites genérico: o vocabulário é de **captação** (campanha,
  repasse, recorrência, termômetro, prestação de contas), não de "landing pages".
- Não inventamos ilustração de marca (blobs, mãos que se cumprimentam em flat design).

### 1.5 Posicionamento vs. concorrentes

| Concorrente | Leitura | Nossa diferença deliberada |
| --- | --- | --- |
| **Doare** | Dashboard branco, limpo, "fintech do bem". Referência direta do painel. | Mantemos a limpeza, mas empurramos **densidade de informação operacional** (funil, composição recorrente x avulso, ticket médio) já na home do painel. |
| **Doação Solutions** | Foco em serviço/consultoria, produto menos aparente. | Somos **produto self-service**: o valor está na tela, não no atendimento. |
| **Doatividade** | Prefixo "doa-" + tom animado. | **Evitamos o prefixo "doa-"** no naming (ver 1.6) e o tom animado na voz. |

Os três se apoiam em "doa-". A folga de marca disponível é justamente **não** fazer isso.

### 1.6 Framework de naming (marca ainda aberta)

**Recomendação: não fechar o nome agora.** Fechar critérios e territórios; decidir depois de
um teste de domínio + INPI. Enquanto isso o placeholder segue "Doações" com o ♥ em quadrado
verde (`PanelSidebar.tsx`, `page.tsx`, `login/page.tsx`).

**Critérios de decisão (peso sugerido):**

1. Distinção fonética e visual perante Doare / Doação Solutions / Doatividade / Vakinha
   (peso alto).
2. `.com.br` **e** `.org.br` livres; `.com` alcançável (peso alto).
3. Registrável no INPI classes 35 (gestão), 36 (financeiro/pagamentos), 42 (software) —
   sem colisão (peso alto).
4. Pronúncia única em pt-BR na primeira tentativa; 2–3 sílabas (peso médio).
5. Espaço para submarcas ("X Repasse", "X Studio", "X para Empresas") (peso médio).
6. Sem conotação negativa / gíria regional; escala para conteúdo internacional já existente
   no produto (`intlDonation`) (peso baixo).

**Territórios (exemplos ilustrativos, não finalistas):**

| Território | Ideia | Amostras | Risco |
| --- | --- | --- | --- |
| Repasse / fluxo | O dinheiro que chega a quem precisa | *Repassa, Lastro, Elo, Correnteza* | "Lastro" tem carga financeira boa mas fria |
| Semente / cultivo | Crescimento do apoio ao longo do tempo (recorrência) | *Broto, Semear, Cultiva* | genérico no setor social |
| Mutirão / coletivo | Muita gente pequena junta | *Mutirão, Cordão, Roda* | "Vaquinha" já é da Vakinha |
| Abstrato curto | Palavra-marca sem significado literal, fácil de possuir | *Ável, Aria, Nível* | exige construção de sentido |
| Descritivo-composto | Direto ao ponto | *CaptaBem, ArrecadaJá* | fraco em distinção, cai no "doa-" |

**Encaminhamento:** priorizar **"Repasse/fluxo"** ou **"Abstrato curto"** — são os dois
territórios que fogem do aglomerado "doa-" e sustentam submarcas. Levar 3 nomes por
território ao teste de domínio/INPI antes de qualquer investimento em logo.

### 1.7 Direção de logotipo (para quando houver nome)

Tratar como um kit, não uma arte final:

- **Símbolo (lead recomendado): "o filete que vira meta".** Uma hairline curta que se
  preenche num pino arredondado — o termômetro de campanha (`progressBar`) reduzido a
  monograma. É o gesto mais honesto do produto: apoio que acumula. Alternativas: canto de
  papel dobrado (recibo — o e-mail de doação "serve como recibo"), broto, mão-coração.
- **Wordmark:** um grotesco humanista (ex.: Inter Display, Söhne, Aeonik) em peso 600,
  tracking levemente negativo (`-0.014em`, igual aos títulos atuais). Caixa: só a inicial
  maiúscula.
- **Lockup:** símbolo à esquerda do wordmark, alinhados pela altura-x. Versão empilhada para
  espaços quadrados.
- **Área de proteção:** igual à altura do contêiner do símbolo (o mesmo `size-7`/`size-6` do
  quadrado atual) em todos os lados.
- **Versões:** (a) cor sobre claro; (b) monocromática `--color-ink` (#17201C); (c) negativa
  branca; (d) símbolo isolado para avatar/rail recolhido; (e) 1 cor para fax/serigrafia.
- **Favicon / app icon:** símbolo dentro do quadrado arredondado verde já em uso — casa com a
  grade de ícones do SO e com o avatar do `PanelSidebar`. Testar legível em 16px e 32px.
- **Uso no produto:** rail do painel (`PanelSidebar`, altura ~28px), cabeçalho `PublicShell`
  (altura 28px, mas ali quem manda é o logo da ONG), rodapé de e-mail (mono, 12px), home de
  marketing (`app/page.tsx`).

**Assinatura do sistema (o elemento que amarra as três superfícies):** o **numeral do
repasse** — o jeito consistente de renderizar dinheiro e progresso. Cifra menor que o valor,
dígitos tabulares (`tabular-nums`, já obrigatório em `th`/`td`/`.tabular-nums`), tracking
apertado, e um filete verde embaixo que, quando há meta, é a própria barra de progresso. Ele
aparece no `Stat` do dashboard, no `progressBar` público e na tabela de valores do e-mail de
recibo. Uma ideia, três telas. Todo o resto fica quieto.

---

## 2. Fundações de token

### 2.1 Onde os tokens vivem hoje

Fonte única atual: bloco `@theme` em **`apps/web/src/app/globals.css`** (Tailwind v4,
`@import "tailwindcss"`). Utilitários customizados (`btn`, `badge`, `eyebrow`) são `@utility`;
`btn-primary`, `input`, `card`, `link`, `badge-*`, `th`, `td` são `@layer components`.
Gotcha v4 já conhecido: `@apply` não enxerga classe de `@layer components`, por isso os três
utilitários base são `@utility`.

**Problema:** e-mails (`packages/emails/src/{index.ts,templates.ts,email-blocks.ts}`) e alguns
renderers de bloco repetem os hex à mão (`#006b4f`, `#2f3b37`, `#8a938f`, `#f4f4f5`,
`#e5e7eb`, `#f2f7f4`, `#e7e2d6`). Não há pacote de tokens; o worker (`apps/worker`) consome
`@donation/emails`, então herda os hex soltos.

### 2.2 Cor — paleta da plataforma (completa)

Valores **mantidos** do `globals.css` atual, com uso e contraste (sobre `#fff`, sRGB / WCAG
2.2). "AA txt" = ≥ 4,5:1 para texto normal; "AA UI" = ≥ 3:1 para texto grande / ícone / borda
de foco.

#### Marca — verde institucional (`--color-brand-*`)

| Token | Hex | Contraste s/ branco | Uso |
| --- | --- | --- | --- |
| `brand-50` | `#eef6f2` | — | wash de item ativo na nav, chips de avatar, fundo de ícone de ação |
| `brand-100` | `#d6ebe2` | — | `::selection`, hover de wash |
| `brand-200` | `#a8d6c6` | — | bordas suaves em fundo verde |
| `brand-300` | `#6fb9a1` | — | série secundária de data-viz (`ALLOC_COLORS`) |
| `brand-400` | `#379a7c` | 2,3:1 | decorativo apenas |
| `brand-500` | `#0d8061` | 3,3:1 | **anel de foco**, stroke de `Sparkline`, barras de data-viz, pontos |
| `brand-600` | `#006b4f` | **6,5:1** | **cor primária**: preenchimento de `btn-primary`, texto de `link`, ícone ativo |
| `brand-700` | `#075642` | 8,0:1 | hover de `btn-primary`, texto de item ativo na nav |
| `brand-800` | `#0a4536` | — | fundo verde escuro (raro) |
| `brand-900` | `#0b382d` | — | fundo verde escuro (raro) |

#### Acento — dourado / selo (`--color-accent-*`)

| Token | Hex | Contraste s/ branco | Uso |
| --- | --- | --- | --- |
| `accent-400` | `#d4b980` | 1,8:1 | **decorativo**: série de data-viz (avulso), wash |
| `accent-500` | `#c5a059` | **2,5:1** | ponto de legenda, detalhe de "selo" — **nunca texto** |
| `accent-600` | `#a9863f` | 3,4:1 | ok para **título grande / ícone**, **não** para corpo |

> O dourado é o único valor da paleta que **não pode carregar texto pequeno**. Tratar como
> ornamento institucional (selo, filete de destaque), não como cor de ação.

#### Neutros quentes

| Token | Hex | Contraste s/ branco | Uso |
| --- | --- | --- | --- |
| `ink` | `#17201c` | 15,7:1 | texto principal, títulos |
| `muted` | `#616b66` | 5,5:1 | texto secundário, descrições |
| `faint` | `#6b756f` | 4,8:1 | `eyebrow`, `th`, placeholder — **limite AA, não clarear** |
| `hairline` | `#96a09a` | 2,0:1 | **decorativo apenas**: chevrons, pontos, traço de sparkline |
| `line` | `#ececeb` | — | hairline padrão (bordas de card, divisórias) |
| `line-strong` | `#e0e0de` | — | borda de input, borda tracejada de empty state |
| `surface` | `#ffffff` | — | fundo de card, sidebar, header sólido |
| `canvas` | `#f8f8f6` | — | fundo do app (off-white morno) |

#### Semânticos (texto + fundo de pílula)

| Token | Hex | Fundo | Contraste texto s/ branco | Contraste texto s/ o próprio `-bg` |
| --- | --- | --- | --- | --- |
| `danger` | `#b3261e` | `danger-bg` `#fdeceb` | 6,5:1 ✔ | ~4,6:1 ✔ (limite) |
| `success` | `#16794c` | `success-bg` `#e8f5ee` | 5,4:1 ✔ | **~3,9:1 ✘** |
| `warn` | `#8a6207` | `warn-bg` `#fdf3dc` | 5,5:1 ✔ | **~3,9:1 ✘** |

> **Achado de contraste:** o texto de `badge-success` e `badge-warn` (11px, `0.6875rem`)
> sobre o próprio fundo pastel fica em ~3,9:1 — reprova AA para texto pequeno. Correção
> proposta (Fase 1): escurecer o texto das pílulas para `success` → `#0f6b43`, `warn` →
> `#7a5606` (mantendo os `-bg`), ou escurecer levemente os `-bg`. `danger` passa raspando —
> escurecer `danger-bg` de leve garante folga.

#### Superfícies (camada semântica a **adicionar**)

| Token novo | Valor | Uso |
| --- | --- | --- |
| `--color-surface` | `#ffffff` (já existe) | superfície elevada: card, sidebar, popover |
| `--color-surface-sunken` | `= canvas` `#f8f8f6` | trilho de progresso, fundo de barra composta, `bg-canvas/70` de hover de linha |
| `--color-surface-overlay` | `rgb(23 32 28 / 0.4)` | scrim do drawer mobile (`bg-ink/40`), overlay de hero |
| `--color-border` | `= line` | alias semântico da hairline padrão |
| `--color-border-strong` | `= line-strong` | alias semântico de borda de controle |

### 2.3 Tipografia — token

- `--font-sans`: **manter** — `var(--font-inter), ui-sans-serif, system-ui, ...` (Inter via
  `next/font/google` em `app/layout.tsx`).
- **Adicionar** `--font-mono` para a linha digitável de boleto e códigos: hoje o template usa
  `font-family:Courier,monospace` inline (`templates.ts`, bloco `BOLETO_INSTRUCTIONS`).
  Token: `ui-monospace, "SF Mono", "Roboto Mono", Menlo, monospace`.
- **Não** adotar face de display na plataforma. Ver §3.

### 2.4 Espaçamento

Hoje: escala default do Tailwind, usada com disciplina (`gap-3`/`gap-4`/`gap-6`,
`px-4 sm:px-6 lg:px-8`, `py-5 lg:py-7`). **Manter a escala do Tailwind** (base 0.25rem);
**não** criar tokens próprios de espaçamento — seria overhead. Documentar o ritmo:

| Contexto | Padding | Gap entre blocos |
| --- | --- | --- |
| Card (`CardBody`) | `px-5 py-4` | — |
| Seção de página (painel) | `px-4 sm:px-6 lg:px-8` / `py-5 lg:py-7` | `space-y-6` |
| Grupo de campos | — | `gap-1.5` (label→campo), `gap-3` (campo→campo) |
| Stat grid | — | `gap-3` |
| Página pública (bloco) | `px-6 py-6` a `py-20` (hero) | herdado do bloco |
| E-mail (card) | `36px 34px` | `14px`/`18px` entre blocos |

### 2.5 Raio

| Token | Valor | Uso hoje | Ação |
| --- | --- | --- | --- |
| `radius-sm` | `0.5rem` | menus, chips pequenos | manter |
| `radius-md` | `0.625rem` | `input`, botões de ícone | manter |
| `radius-lg` | `0.75rem` | popover, alert | manter |
| `radius-xl` | `1rem` | `card` | manter |
| — pílula | `9999px` **hardcoded** em `@utility btn` e em `badge` | botões e pílulas do painel | **adicionar** `--radius-pill: 9999px` e referenciar |

**Raio de botão é o único item de raio que o inquilino controla** (`full` / `md` / `none`),
e **só nas páginas públicas** (`ButtonRadius` em `render-static.tsx`). O painel é sempre
pílula.

### 2.6 Elevação / borda

Hoje: `--shadow-card: 0 1px 2px rgb(20 24 22 / 0.04)` (quase nulo) — é a única sombra, e
menus reusam ela (`PanelSidebar` dropdown). A linguagem é **borda, não sombra**.

**Adicionar** um segundo nível só para conteúdo que flutua sobre o cursor:

| Token novo | Valor | Uso |
| --- | --- | --- |
| `--shadow-card` | (manter) | repouso: card, sidebar |
| `--shadow-pop` | `0 4px 12px rgb(20 24 22 / 0.08), 0 1px 3px rgb(20 24 22 / 0.06)` | menu, popover, dropdown do org switcher, `RowMenu` |

Regra: no máximo dois níveis. Nada de sombra em card estático.

### 2.7 Breakpoints

Manter os do Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`). O painel troca
de layout em `lg` (sidebar vira drawer — `PanelChrome`). As páginas públicas usam
**container queries** (`@lg`, `@xl`, `@2xl` em `render-static.tsx`) porque o bloco pode estar
em preview estreito no Studio — **manter esse padrão** e documentá-lo: bloco público =
container query; chrome do app = media query.

### 2.8 Z-index (a tokenizar — hoje são números soltos)

Valores em uso: `z-20` (header do painel), `z-50` (drawer), `z-[60]` (skip link),
`z-20` (dropdown do org switcher). Propor escala nomeada em `@theme`:

| Token | Valor | Uso |
| --- | --- | --- |
| `--z-base` | `0` | conteúdo |
| `--z-sticky` | `20` | header sticky, sidebar sticky |
| `--z-dropdown` | `30` | org switcher, `RowMenu` |
| `--z-overlay` | `50` | scrim + drawer mobile |
| `--z-toast` | `60` | skip link, toasts, notificações |

### 2.9 Motion / duração (a tokenizar — hoje inline)

Em uso: `transition ... 0.14s ease` (`btn`), `transition-[width] duration-200` (sidebar),
`transition-colors` (linhas de tabela, itens de nav), `hover:scale-110` (swatch do
`ThemePanel`), `transition-transform` (chevrons). Propor:

| Token | Valor | Uso |
| --- | --- | --- |
| `--duration-fast` | `120ms` | cor de hover/press (botão, link, item de nav) |
| `--duration-base` | `160ms` | fade/rise de popover, foco |
| `--duration-slow` | `240ms` | largura da sidebar, drawer, altura de acordeão |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | entradas e saídas gerais |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | elementos que aparecem |

### 2.10 Mapa de ação sobre o `@theme` atual

| Token atual | Ação | Observação |
| --- | --- | --- |
| `--color-brand-*` (50–900) | **manter** | escala completa e bem calibrada |
| `--color-accent-*` (400/500/600) | **manter** + documentar "não-texto" | considerar `accent-700 #8a6d33` (~4,6:1) se algum dia precisar de dourado em texto |
| `--color-ink / muted / faint` | **manter**; adicionar aliases `--color-text / -muted / -subtle` | migração opcional, sem renomear já |
| `--color-hairline` | **renomear** para `--color-border-decorative` (alias, manter o antigo) | o nome "hairline" confunde com `line` |
| `--color-line / line-strong` | **manter** + aliases `--color-border / -strong` | |
| `--color-surface / canvas` | **manter** + adicionar `-sunken / -overlay` (§2.2) | |
| semânticos `danger/success/warn` (+ `-bg`) | **ajustar** `success`/`warn` p/ legibilidade em pílula (§2.2) | adicionar `--color-info` = `brand-600` para `Alert`/`Badge` tom neutro-informativo |
| `--radius-*` | **manter**; adicionar `--radius-pill` | |
| `--shadow-card` | **manter**; adicionar `--shadow-pop` | |
| — | **adicionar** `--font-mono`, `--z-*`, `--duration-*`, `--ease-*` | |

Nenhum token é removido. Tudo que muda de nome ganha **alias** e a migração é oportunista.

---

## 3. Tipografia

### 3.1 Família

- **Inter** para toda a UI (painel + público). Já carregada com `display: "swap"` e
  `variable: "--font-inter"`.
- **Sem face de display de marca.** Justificativa: a personalidade (§1.2) é "neutra por
  escolha"; um display próprio competiria com a identidade da ONG na página pública. O
  "risco" tipográfico do sistema é outro e é específico do produto: o **numeral do repasse**
  (§1.7) — Inter com `font-variant-numeric: tabular-nums`, tracking `-0.02em` nos valores
  grandes, cifra em `0.7em`. É o único tratamento tipográfico que a plataforma "possui".
- **E-mail:** `Arial, Helvetica, sans-serif` (o shell já força isso; Outlook/Word não
  renderiza webfont com segurança). O fallback de Inter para Arial é aceitável porque as
  métricas são próximas. Não tentar webfont em e-mail.
- **Monospace:** só para linha digitável de boleto e chave Pix (`--font-mono`, §2.3).

### 3.2 Escala tipográfica (nomes propostos)

Consolidar os tamanhos hoje soltos (`text-2xl`, `text-[1.375rem]`, `text-[0.8125rem]`,
`text-[0.6875rem]`, `text-[0.95rem]`...) numa escala nomeada, exposta como `@utility` no
`globals.css`:

| Nome | Tamanho / linha | Peso / tracking | Uso |
| --- | --- | --- | --- |
| `text-display` | 30–36px / 1.1 | 600 / `-0.02em` | hero de página pública (`render-static` hero), home de marketing |
| `text-title` | 24px / 1.2 | 600 / `-0.014em` | `<h1>` de página do painel (`PageHeader`), `text-2xl` atual |
| `text-heading` | 18px / 1.25 | 600 / `-0.01em` | `CardHeader` título, seções |
| `text-subhead` | 16px / 1.3 | 600 | `h2` de card no dashboard |
| `text-body` | 15px / 1.55 | 400 | corpo de página pública, e-mail (15px casa com o shell) |
| `text-ui` | 13px / 1.45 | 400–500 | **densidade do painel** — o onipresente `text-[0.8125rem]` |
| `text-caption` | 12px / 1.4 | 400 | `hint`, `field-error`, legendas, sub de `Stat` |
| `text-eyebrow` | 11px / 1.4 | 600 / `0.06em` / uppercase | `eyebrow` (já existe como `@utility`) e `th` |
| `text-num` | herda + `tabular-nums` `-0.02em` | 600 | valor de `Stat`, `SummaryStrip`, célula numérica |

Regras:

- `<h1>/<h2>/<h3>` já recebem `line-height: 1.2; font-weight: 600; letter-spacing: -0.014em`
  no `@layer base` — **manter**; a escala acima é para quando o elemento não é um heading
  semântico (ex.: valor de stat num `<div>`).
- **Painel** usa `text-ui` (13px) como corpo — é a decisão de densidade e está certa para
  dashboard. **Público** usa `text-body` (15px). **Não** misturar.
- Corpo de e-mail: 15px / 1.6 (já no shell). AAA para corpo (7:1) é atingível com `ink`
  (#2f3b37 no e-mail = 9,7:1) — bom.
- Números **sempre** `tabular-nums` (já forçado em `th`, `td`, `.tabular-nums`).

### 3.3 Uso por superfície

| | Painel | Público (ONG) | E-mail |
| --- | --- | --- | --- |
| Face | Inter | Inter | Arial/Helvetica |
| Corpo | `text-ui` 13px | `text-body` 15px | 15px / 1.6 |
| Título | `text-title` 24px | `text-display` 30–36px | `h1` 20–24px |
| Cor de título | `ink` | `ink` (ou acento em `impactCounters`) | `#2f3b37` |
| Tracking | `-0.014em` | `-0.02em` no display | padrão |

---

## 4. Sistema de componentes

Camada: **`apps/web/src/components/ui/`** (barril em `index.ts`; o texto do briefing chama de
`@donation/ui` — hoje é o alias `@/components/ui`, ainda não um pacote de workspace). Regra
transversal: **feature nunca escreve hex nem `text-[...]px` cru** — usa token + primitivo.

Estados obrigatórios por componente interativo: `default, hover, focus-visible, active,
disabled, loading` e, quando aplicável, `error, success, selected, empty`.

### 4.1 Button / LinkButton (`Button.tsx`)

Hierarquia (mapeada nos utilitários de `globals.css`):

| Nível | Variante | Aparência | Quando |
| --- | --- | --- | --- |
| Primário | `primary` | `bg-brand-600` texto branco, hover `brand-700` | **uma por tela** — a ação principal |
| Secundário | `secondary` | contorno `line-strong`, `bg-surface`, hover borda `muted/40` + `bg-canvas` | ações de apoio ("Entrar", "Continuar com Google") |
| Terciário | `ghost` | texto `brand-600`, hover `bg-brand-50` | ação de baixo peso em contexto denso (linha de tabela, toolbar) |
| Perigo | `danger` | `bg-danger` texto branco | destrutivo confirmado — nunca como primário competindo |

Tamanhos: `md` (padrão) e `sm` (`btn-sm`). Raio: sempre pílula no painel.

**Lacunas a fechar (Fase 3):**

- **`loading`**: hoje o `login/page.tsx` troca o texto manualmente (`"Entrando…"`). Adicionar
  prop `loading` → `disabled` + `aria-busy` + spinner `lucide` `Loader2` (o Studio já usa
  esse ícone). Texto permanece; spinner à esquerda.
- **`size="icon"`**: botões só-ícone (menu, fechar, recolher) hoje são `<button>` avulsos com
  `grid size-8 place-items-center` repetido em `PanelChrome`/`PanelSidebar`. Formalizar
  `IconButton` ou `Button size="icon"` (`size-8`, `radius-md`, `aria-label` obrigatório).
- **Alvo de toque**: garantir mínimo 24×24 CSS px (WCAG 2.2 2.5.8). `size-7` (28px) passa;
  auditar qualquer `size-6`.

Anti-padrões: dois primários na mesma vista; `danger` para "Cancelar" (isso é `secondary` ou
`ghost`); botão sem rótulo textual quando não é ícone universal.

### 4.2 Campos (`Field.tsx` + utilitário `.input`)

`Field` já força **rótulo visível** (`<span class="label">`) e encadeia `hint`/`error`. Bom.
`Input/Textarea/Select` compartilham `.input` (`border-line-strong`, foco
`border-brand-500`). `Checkbox` usa `accent-brand-600` nativo.

Matriz de estados a implementar (Fase 3):

| Estado | Tratamento |
| --- | --- |
| default | `.input` atual |
| hover | borda `muted/40` (alinhar com `btn-secondary`) |
| focus | **anel** `:focus-visible` global (2px `brand-500`, offset 2) — hoje o input só troca a cor da borda; adotar o anel para consistência |
| disabled | `opacity-0.5`, `cursor-not-allowed`, `bg-canvas` |
| error | `aria-invalid="true"` + `data-invalid` → borda `danger`, e `Field` já mostra `.field-error`; ligar `aria-describedby` ao id da mensagem |
| success | borda `success` + ícone `Check` opcional (usar com parcimônia: só quando a validação assíncrona confirma, ex. slug disponível) |
| loading | ícone spinner à direita + `aria-busy` (ex.: checando domínio em `domains/page.tsx`) |
| required | asterisco no `label` + `aria-required`; **não** usar só "(opcional)" em uns e nada em outros — escolher uma convenção |

Regras de form (skill form-ux):

- **Nunca rótulo só-placeholder.** `login/page.tsx` usa `placeholder="E-mail"` / `"Senha"` —
  **violação** das regras do projeto; migrar para `Field label=...` (Fase 0).
- Mensagem de erro diz **como recuperar** e preserva o que foi digitado.
- `type`/`inputmode` corretos: `email`, `tel`, `numeric` para valores; `autocomplete`.
- Prevenir duplo submit: `disabled` durante `loading` (o Studio e o login já fazem; padronizar
  no `Button`).

### 4.3 Card (`Card.tsx`)

`Card` = `.card` (`rounded-xl border-line bg-surface`, sem sombra). `CardHeader` (título +
descrição + ação, borda inferior) e `CardBody` (`px-5 py-4`). Usar card **só quando agrupar
melhora a compreensão** — o dashboard acerta (composição, funil, top campanhas são grupos
reais). Anti-padrão: um card por parágrafo.

### 4.4 Tabela (`Table.tsx`)

`Table` (wrapper com `overflow-x-auto`), `Th` (`.th` — 11px uppercase `faint`), `Td`
(`.td` — `text-sm py-3`), `Tr` (borda superior, `first:border-t-0`). Hover de linha
`bg-canvas/70`. Sem zebra (correto para densidade média).

Adições (Fase 3):

- **Densidade compacta**: variante `dense` (`py-2`, `text-ui`) para listas longas de
  transações/pagamentos.
- **Ordenação**: `Th` com `sortable` → botão interno + ícone `ChevronsUpDown`/`ChevronUp`,
  `aria-sort`.
- **Cabeçalho fixo**: `sticky top-0` opcional para tabelas com scroll vertical.
- **Coluna numérica**: helper `align="right"` + `tabular-nums` (o `campaigns/page.tsx` já
  aplica `className="tabular-nums"` à mão — encapsular).
- **Ação por linha**: `RowMenu` (`…`) é o padrão; documentar que a área clicável primária é o
  link do nome, não a linha inteira.
- Mobile: abaixo de `sm`, tabela de 4+ colunas vira lista de cartões (label: valor) — não
  encolher a tabela. (skill responsive-pro)

### 4.5 Badge / StatusBadge (`Badge.tsx`)

`Badge` tom `neutral | success | warn | danger` (→ `badge-*`). **`StatusBadge` é a fonte
única** de pílula de status: `STATUS_MAP` cobre campanha, KYC, doação, recorrência, rifa,
evento, leilão, apadrinhamento. **Regra:** nenhuma página renderiza enum cru — sempre
`<StatusBadge status=...>`.

Adições:

- Tom **`info`** (fundo `brand-50`, texto `brand-700`) para estados neutros-informativos que
  hoje caem em `neutral` cinza (ex.: "Em análise" poderia ser `info` em vez de `warn`).
- Corrigir contraste do texto (§2.2, Fase 1).
- Opção `dot` (bolinha de status antes do texto) para uso fora de pílula.

### 4.6 Navegação (`PanelChrome.tsx` + `PanelSidebar.tsx`)

- Rail sticky, `w-64` / `w-[3.75rem]` recolhido (persistido em `localStorage`
  `panel:nav-collapsed`). Grupos: `Captação`, `Relacionamento`, `Conta`.
- **Ativo**: `bg-brand-50 text-brand-700` + marcador `brand-600` (barra 3px à esquerda /
  sublinhado no modo recolhido). Ícone ativo em `brand-600`. Padrão sólido, manter.
- **Plano**: item sem acesso mostra cadeado (`Lock`) e continua clicável (leva à tela de
  upsell) — **não** esconder (regra de segurança: visibilidade de frontend não é controle de
  acesso; o gate real é no servidor).
- Header: trilha (`breadcrumb`) + avatar. Drawer mobile com **foco preso** (Esc fecha, foco
  volta ao gatilho — já implementado em `PanelChrome`). Skip link "Pular para o conteúdo"
  presente.
- Org switcher: `<details>` nativo (acessível por teclado) com `shadow-pop` (hoje reusa
  `shadow-card` — trocar).

### 4.7 Empty / loading / skeleton

- **EmptyState** (`Page.tsx`): hoje só texto em caixa tracejada. Adicionar slots opcionais
  `icon` (lucide, 20px, `faint`) e `action` (`LinkButton`). Copy = o próximo passo, não o
  lamento ("Nenhuma campanha ainda. Crie a primeira.").
- **Loading**: adicionar `Skeleton` (bloco `bg-line` com shimmer sutil, respeitando
  `prefers-reduced-motion`) para as áreas de dashboard/tabela que hoje não têm estado de
  carregamento explícito.
- **Alert** (`Page.tsx`): tons `warn | danger | success`; adicionar `info`; slots opcionais
  `title`, `icon`, `onDismiss`. `role="alert"` só em `danger` (já feito), `status` nos demais.

### 4.8 Acessibilidade dos primitivos (resumo — detalhe no §11)

- Foco visível: `:focus-visible` global (2px `brand-500`, offset 2, `border-radius: 4px`) —
  **manter e garantir** que `<summary>`, swatches do `ThemePanel` e itens de `RowMenu` o
  recebem.
- Contraste: paleta clareia AA no branco, exceto dourado (decorativo) e texto de pílula
  `success`/`warn` (corrigir).
- Alvo de toque ≥ 24px.
- Semântica: `<button>` para ação, `<a>`/`Link` para navegação (o `LinkButton` existe
  justamente para isso — não estilizar `<div>` como botão).

---

## 5. Consistência entre as três superfícies

**Compartilham:** os valores de token (verde `#006B4F` = `brand-600` = a cor de link e botão
do e-mail; neutros quentes; intenção de raio; ritmo de espaço; `tabular-nums`; voz pt-BR do
§1.3; o "numeral do repasse" do §1.7). **Não compartilham:** temperatura e densidade.

| | Painel (`app.<host>`) | Sites públicos (`{slug}.<host>`) | E-mails (`packages/emails`) |
| --- | --- | --- | --- |
| Objetivo | operar a captação | converter o doador | confirmar / lembrar / recuperar |
| Fundo | `canvas` `#f8f8f6` | branco + seções `canvas` | `#f4f4f5` (alinhar a `canvas`? ver abaixo) |
| Densidade | alta (`text-ui` 13px) | baixa, editorial (`text-body` 15px) | média, 1 coluna, 600px |
| Cor de destaque | **verde da plataforma** (fixo) | **acento do inquilino** | verde da plataforma; logo da ONG opcional no topo |
| Tipografia | Inter | Inter | Arial/Helvetica (web-safe) |
| Componentização | `@/components/ui` | blocos (`packages/blocks` + `render*.tsx`) | tabelas HTML inline (`email-blocks.ts`) |
| Sombra | hairline, `shadow-card` | hairline | borda 1px `#e5e7eb`, sem sombra |
| Raio | pílula (fixo) | `full/md/none` do inquilino | botão `full/md/none` por bloco de e-mail |
| Personalização do inquilino | **nenhuma** | acento + raio + logo | logo + (subject/corpo dos 20 templates) |

**Regras de consistência:**

1. O painel é **100% plataforma**. O inquilino não muda nada nele. É o ambiente de trabalho
   neutro — como o Doare.
2. A página pública é **do inquilino**. A plataforma entra só no rodapé ("Feito com a
   plataforma de doações" — `PublicShell.tsx` e bloco `footer`). O acento verde vira o acento
   da ONG.
3. O e-mail é **híbrido**: chassi da plataforma (o shell 600px table-based à prova de
   Outlook), com o logo da ONG no topo quando houver (`renderTemplate({ logoUrl })`) e a
   assinatura "Enviado por {ORGANIZACAO}." no rodapé. O verde dos botões continua o da
   plataforma (decisão: previsibilidade de renderização e reputação de entrega valem mais
   que colorir o botão com o acento da ONG em e-mail).
4. **Fundo do e-mail (`#f4f4f5`) x `canvas` (`#f8f8f6`):** hoje divergem por 1 dígito.
   Recomendação: alinhar ambos ao mesmo token (`--color-canvas`), exposto no pacote de
   tokens, para que o e-mail e o app tenham o mesmo off-white. Diferença atual é acidental,
   não intencional.
5. A moldura de e-mail recém-redesenhada (`SHELL` em `templates.ts`, `shell()` em `index.ts`)
   é a **referência** de "plataforma discreta emoldurando conteúdo da ONG" — o mesmo
   princípio do `PublicShell`.

**Dívida a pagar:** existem **dois** shells de e-mail quase idênticos — `shell()` em
`index.ts` (20 funções hardcoded) e `SHELL` em `templates.ts` (20 templates editáveis por
bloco). Unificar num único shell importado de um lugar (Fase 2), parametrizado por
`logoUrl`/`orgName`, para não divergirem.

---

## 6. Theming por inquilino (multi-tenant)

### 6.1 Modelo atual

Cada `Organization` tem um JSON `branding`: `primaryColor`, `secondaryColor`, `accentColor`,
`buttonRadius`. A aba **Tema** do Studio (`apps/web/src/blocks/studio/ThemePanel.tsx`) salva
**só** `accent` (cor) + `radius` (`full|md|none`) via `saveOrgTheme` → `Organization.branding`
(tipo `Theme` em `Studio.tsx` = `{ accent, radius }`). Isso alimenta o `StaticCtx`
(`render-static.tsx`): `accent`, `radius`, e o helper `onAccent(hex)` (cor de texto legível
sobre o acento). Os renderers públicos (`render.tsx`, `render-static.tsx`) leem
`ctx.org.branding.primaryColor` como acento e caem em `#006B4F` quando vazio.

**Inconsistências a resolver (Fase 1):**

- `branding` declara `secondaryColor` e `accentColor` que **nada consome**. Decidir:
  canonizar o JSON em `{ primaryColor, buttonRadius, logoUrl }` (e manter os outros campos
  aceitos mas ignorados por compat) OU dar uso a eles. Recomendação: **canonizar em um só
  acento** — menos decisões para a ONG, menos superfície de erro.
- `ThemePanel` usa a chave `accent`; `render.tsx` lê `primaryColor`. Alinhar o nome em todo o
  caminho (`ThemePanel` → `saveOrgTheme` → `branding.primaryColor` → `RenderContext` →
  `StaticCtx.accent`).

### 6.2 O que o inquilino sobrescreve

| Token | Sobrescreve? | Onde aplica |
| --- | --- | --- |
| **Cor de acento** (1 hex) | ✔ | CTA de `hero`/`cta`/`imageText`, preenchimento do `progressBar`, opção selecionada de `amountOptions`, numerais de `impactCounters`, aspas/avatar de `testimonials`, chip de número de `steps`, wash de `matchBanner`, acentos do checkout |
| **Raio de botão** (`full/md/none`) | ✔ | todos os botões/CTAs dos blocos públicos (`RADIUS_CLASS`) |
| **Logo** | ✔ | topo do `PublicShell`, topo do e-mail (`logoUrl`) |
| Neutros, superfícies, linhas | ✘ | fixos da plataforma |
| Cores semânticas (erro/sucesso/aviso) | ✘ | fixas — segurança de leitura |
| Tipografia, escala, espaçamento, layout dos blocos | ✘ | fixos |
| Qualquer coisa no painel | ✘ | painel é plataforma |

### 6.3 Guarda-corpo de contraste do acento (substitui `onAccent`)

Hoje `onAccent()` usa **luminância perceptual simples** (`lum > 0.62 ? ink : #fff`). É
aproximado e não garante WCAG. Proposta de algoritmo (helper isomórfico em
`render-static.tsx`, sem dependência):

```
entrada: accentHex (validado /^#[0-9a-f]{6}$/i; senão → fallback #006B4F)

1. L_accent = luminância relativa WCAG do accent
2. onAccent(accent):
     contraste(#ffffff, accent) >= contraste(#17201c, accent) ? "#ffffff" : "#17201c"
   (escolhe o texto — branco ou ink — que dá o MAIOR contraste; alvo >= 4.5:1)
   Se nenhum dos dois alcança 4.5:1 sobre o accent puro (acento "meio-tom"),
   usar o de maior contraste e registrar aviso no Studio.
3. accentInk (para TEXTO/LINK do acento sobre fundo branco):
     se contraste(accent, #ffffff) >= 4.5  -> accentInk = accent
     senão -> escurecer o accent (reduzir L em HSL/OKLCH em passos de ~6%)
              até contraste(accentInk, #ffffff) >= 4.5 (limite de 8 iterações)
   Fills continuam usando o accent PURO; só texto/ícone-sobre-branco usa accentInk.
4. Rampa derivada:
     accent-wash  = mix(accent, #ffffff, 92%)   // fundo de banner (matchBanner usa accent14 hoje)
     accent-soft  = mix(accent, #ffffff, 86%)    // hover de wash, chip
     accent-hover = mix(accent, #000000, 8%)     // hover de botão preenchido
     accent-ring  = accent a 50% alpha           // foco em controles do inquilino
5. Barra de progresso e trilhos continuam com o accent puro sobre `surface-sunken`.
```

Regras rígidas: o acento **nunca** vira cor de texto de corpo, **nunca** é o único sinal
(erro/sucesso continuam semânticos), **nunca** pinta borda que seja a única indicação de
estado.

### 6.4 Fallback

Sem tema configurado: `accent = #006B4F` (`brand-600`), `radius = full`, sem logo (mostra a
inicial da ONG em quadrado com o acento — `PublicShell` já faz). Documentar que **o padrão já
é uma marca boa** — a ONG não é obrigada a escolher nada.

### 6.5 Prévia no Studio

`ThemePanel` já mostra uma prévia viva do botão "Doar agora" com `onAccent`. Estender
(Fase 1):

- Prévia = botão **+ barra de progresso + um `Stat`** com o acento, para a ONG ver os três
  usos.
- **Aviso de contraste** quando o acento reprova sobre branco:
  *"Esse tom tem pouco contraste no branco. Nos textos e links vamos usar um tom mais escuro
  automaticamente; nos botões, mantemos a sua cor."* (voz do §1.3: explica a recuperação, não
  culpa.)
- Presets atuais (`#006B4F`, azuis, roxo, rosa, laranja, vermelho, quase-preto) — manter, mas
  reordenar começando pelo verde e agrupando por família; marcar os que exigem "accentInk".

---

## 7. Data-viz

Sem biblioteca de gráfico — SVG inline e barras `div` (`Sparkline`, `SummaryStrip`,
composição do dashboard). **Manter essa restrição** (perf, bundle, controle de estilo).

### 7.1 Paleta de séries

Ordem canônica (casa com `ALLOC_COLORS` de `render-static.tsx`):

| # | Token | Uso |
| --- | --- | --- |
| 1 | `brand-500` `#0d8061` | série principal (arrecadado, recorrente) |
| 2 | `accent-400` `#d4b980` | série secundária (avulso) |
| 3 | `brand-300` `#6fb9a1` | terceira |
| 4 | `faint` `#6b756f` | quarta / "outros" |
| 5 | `line-strong` `#e0e0de` | quinta / vazio |

Máximo 5 séries; além disso, agrupar em "Outros". Sem gradiente (exceção: o preenchimento de
área do `Sparkline` a `fillOpacity 0.08` — manter). Sem 3D, sem donut com furo decorativo.

### 7.2 Componentes numéricos

- **`Stat`** (`Page.tsx`): ponto de cor (`brand/accent/success/warn/neutral`) + `eyebrow` +
  valor 22px `tabular-nums tracking-tight` + `DeltaBadge` + `sub` + `Sparkline` opcional.
  Anatomia oficial do "tile de KPI". Adotar `text-num` (§3.2) no valor.
- **`DeltaBadge`**: pílula `↑/↓` em `success-bg`/`danger-bg`, `%` com **uma casa** e vírgula
  (`.toFixed(1).replace(".", ",")` — já correto), `sr-only` "aumento de"/"queda de" (já
  presente). `pct == null` → `—`.
- **`SummaryStrip`**: fileira de stats separados por hairline + barra de composição empilhada
  + legenda com pontos e `%`. Padrão de cabeçalho de página de lista (estilo "Transações" do
  Doare). Manter.
- **Barra de composição** (dashboard `page.tsx`): `brand-500` (recorrente) x `accent-400`
  (avulso) sobre `surface-sunken`, altura 2–2,5px arredondada, legenda com `%` inteiro.
- **Barras horizontais** (top campanhas): trilho `surface-sunken`, preenchimento `brand-500`,
  `Math.max(2, pct)` para a menor barra continuar visível — manter.

### 7.3 Formatação pt-BR

| Dado | Formato | Fonte |
| --- | --- | --- |
| Moeda | `R$ 1.234,56` | `formatBRL` (`packages/shared/src/money.ts`, `Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"})`) |
| Inteiro | `1.234` | `Number.toLocaleString("pt-BR")` (já usado em `impactCounters`) |
| Percentual | `12,3%` (1 casa) ou `12%` (inteiro em legenda) | `.replace(".", ",")` |
| Data | `dd/mm/aaaa, hh:mm` | `Date.toLocaleString("pt-BR")` (já usado nos e-mails) |
| Vazio | `—` | nunca `0` disfarçado de dado; nunca `NaN` |

Estado vazio de gráfico: frase curta ("Nenhuma doação paga no período." — já em uso), nunca
eixo fantasma.

---

## 8. Iconografia e imagística

### 8.1 Ícones — `lucide-react`

| Regra | Valor |
| --- | --- |
| Tamanhos | 16px (`size-4`) em UI densa/nav; 20px (`size-5`) em conteúdo; 24px máx. Pontos de status: `size-1.5`. |
| Traço | padrão do lucide (~2px). Não redesenhar. |
| Cor | herda `currentColor`; decorativo em `faint`, ativo em `brand-600`. |
| Semântica | ícone decorativo → `aria-hidden`; ícone que é a única label → `aria-label` (ex.: `IconButton`). |
| Quando **não** usar | não pôr ícone em todo item de lista/rótulo. A nav usa ícone porque ajuda a varredura; um formulário não precisa. |
| Consistência | um conceito, um ícone (o `PanelSidebar` já mapeia seção→ícone fixo; `block-icons.tsx` idem). Não trocar `Megaphone` por `Bullhorn` em outra tela. |

Não misturar outra biblioteca de ícones. Sem ícone "significando nada" (regra do projeto).

### 8.2 Imagens de campanha (conteúdo da ONG)

- **Proporções**: hero `16:9` (com texto sobreposto); `imageText` `4:3`; `gallery` quadrado
  variável; `image` livre com `rounded-xl`; avatar `1:1`; `embed`/vídeo `16:9`/`9:16`
  (`RATIO_PAD`).
- **Overlay do hero**: hoje `rgba(0,0,0, overlay)` com `overlay` default `0.4`
  (`render-static.tsx`). Recomendação: quando houver título sobre a foto, **mínimo 0.35** e
  preferir um **scrim em gradiente** (topo/baixo) em vez de véu chapado, para não apagar
  rostos. Garantir contraste ≥ 4,5:1 do título branco sobre a região mais clara da foto.
- **Direção**: fotografia documental de pessoas/beneficiários com dignidade e consentimento;
  luz natural; evitar banco de imagem genérico e "pobreza estetizada". A plataforma **não**
  fornece ilustração de marca.
- **Tratamento**: sem filtro pesado, sem duotone forçado. Cantos `rounded-xl`/`rounded-2xl`
  conforme o bloco (já padronizado).
- **Placeholders**: caixa tracejada `border-line-strong` + texto `faint` ("Sem imagem",
  "Nenhuma imagem na galeria") — padrão já consistente em `render-static.tsx`. Manter.
- **Logo da ONG**: `object-contain`, altura 28px (`PublicShell`) a 44px (e-mail), PNG
  transparente ou SVG; nunca esticar.

### 8.3 Imagística da plataforma

Praticamente nenhuma — e é proposital. A home de marketing (`app/page.tsx`) é tipografia +
um ícone. Se um dia houver material institucional: hairline, tabela, número — o mesmo
vocabulário estrutural do produto.

---

## 9. Motion

### 9.1 Princípios

1. Movimento **confirma uma mudança de estado**; não decora nem entretém.
2. Um momento orquestrado (a barra de progresso preenchendo ao carregar a página pública)
   vale mais que dez microefeitos espalhados.
3. Curto. Nada acima de 240ms na UI.
4. `prefers-reduced-motion: reduce` sempre respeitado.

### 9.2 O que anima

| Elemento | Propriedade | Duração / ease | Já existe? |
| --- | --- | --- | --- |
| Botão, link, item de nav | `background-color`, `color`, `border-color` | `--duration-fast` / `--ease-standard` | sim (`0.14s ease`) |
| Sidebar recolher | `width` | `--duration-slow` | sim (`duration-200`) |
| Drawer mobile | `transform` + scrim `opacity` | `--duration-slow` / `--ease-out` | parcial |
| Popover / menu / org switcher | `opacity` + `translateY(2px→0)` | `--duration-base` / `--ease-out` | não (aparece seco) |
| Linha de tabela hover | `background-color` | `--duration-fast` | sim |
| Barra de progresso pública | `width` de 0→valor no mount | `--duration-slow` | não |
| Skeleton | shimmer sutil | loop 1.5s | não (criar) |

### 9.3 O que NÃO anima

Transição de página; parallax; contadores que sobem sozinhos **sem** checar reduced-motion
(`impactCounters` tem `animate: true` por padrão — **gatear** por `prefers-reduced-motion` e
por viewport); hover em elemento não interativo; `scale` em conteúdo (o `hover:scale-110` do
swatch do `ThemePanel` é tolerável por ser controle pequeno, mas padronizar para um realce de
borda).

### 9.4 Implementação

Adicionar ao `@layer base` do `globals.css` (hoje **ausente**):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

E os contadores/barras checam `window.matchMedia("(prefers-reduced-motion: reduce)")` para ir
direto ao valor final.

---

## 10. Modo escuro

**Recomendação: não fazer agora.** Prioridade abaixo de RLS, deploy e nome de marca.

| Superfície | Recomendação |
| --- | --- |
| **Sites públicos das ONGs** | **Nunca** dirigido pela plataforma. A ONG controla a aparência; um dark automático quebraria a paleta dela e o contraste do acento. Se um dia existir, é opção explícita por inquilino, fora deste escopo. |
| **Painel** | Adiável para uma fase futura (Fase 5, opcional). É o único lugar onde dark faz sentido (uso prolongado, ambiente de trabalho). |
| **E-mail** | **Nunca** um tema escuro próprio. Clientes de e-mail invertem cores de forma imprevisível; a defesa é usar cores sólidas (o shell já faz), evitar texto branco sobre transparente, e declarar `<meta name="color-scheme" content="light">` / `supported-color-schemes`. |

**Preparação sem custo agora (Fase 0/4):** introduzir a **camada semântica** de tokens
(`--color-text`, `--color-surface`, `--color-surface-sunken`, `--color-border`, …) como
aliases dos valores atuais. Com isso, adicionar dark no futuro é um bloco
`[data-theme="dark"] { --color-surface: ...; }` + um toggle no `PanelChrome` — **adição, não
reescrita**. Sem essa camada, o dark seria um find/replace de centenas de classes.

---

## 11. Acessibilidade

Alvo: **WCAG 2.2 AA**; AAA para corpo de texto onde já sai de graça (`ink` em branco =
15,7:1; corpo de e-mail `#2f3b37` = 9,7:1).

### 11.1 Checklist por componente

| Componente | Checks |
| --- | --- |
| **Button / LinkButton** | `<button>` p/ ação, `Link` p/ navegação; `:focus-visible` anel; `disabled` + `aria-busy` no loading; alvo ≥ 24px; rótulo textual ou `aria-label`; não usar `title` como única label |
| **Field / Input** | rótulo **visível** sempre (nunca só placeholder); `aria-invalid` + `aria-describedby` no erro; `id` único; `autocomplete`/`inputmode`; erro não só por cor |
| **Checkbox / Select** | rótulo associado (`<label>` envolvente já faz); foco visível; estado via texto, não só cor |
| **Table** | `<th scope>`; `aria-sort` se ordenável; `caption` ou `aria-label`; em mobile reflui p/ lista (não scroll infinito escondendo dado) |
| **StatusBadge** | texto traduzido (não só cor/ícone); contraste do texto ≥ 4,5:1 (corrigir `success`/`warn`) |
| **Alert** | `role="alert"` só em `danger`; `status` nos demais; ícone com `aria-hidden`; texto explica ação |
| **Nav / Sidebar** | `aria-current="page"` no ativo (já feito); grupos com heading; item bloqueado por plano continua focável e anunciado ("(plano)") |
| **Drawer mobile** | `role="dialog"` `aria-modal` (já); foco preso; Esc fecha; foco volta ao gatilho (já); `body` sem scroll (já) |
| **Skip link** | "Pular para o conteúdo" → `#conteudo` (já presente em `PanelChrome`) |
| **Sparkline / gráfico** | `aria-hidden` no SVG **+ equivalente textual próximo** (o valor e o delta já ficam ao lado no `Stat` — garantir sempre) |
| **Studio (DnD)** | `KeyboardSensor` já configurado; garantir instruções e anúncio de posição |
| **ThemePanel swatches** | `<button>` com `aria-label` ("Usar #006B4F") — já tem; foco visível |

### 11.2 Contraste — pendências concretas

1. Texto de `badge-success` / `badge-warn` sobre `-bg`: ~3,9:1 → escurecer texto
   (`#0f6b43` / `#7a5606`) ou os fundos. **(Fase 1)**
2. `faint` (#6b756f, 4,8:1) está no limite de AA — **não** clarear em nenhuma hipótese;
   documentar como piso.
3. `accent-500` (dourado, 2,5:1) e `hairline` (2,0:1) são **decorativos** — nunca texto,
   nunca borda que seja o único sinal. Adicionar comentário no `@theme`.
4. Título branco sobre foto de hero: exigir overlay ≥ 0.35 e verificar 4,5:1. **(Fase 1)**
5. Acento do inquilino: guarda-corpo do §6.3 garante 4,5:1 em texto/link derivando
   `accentInk`.

### 11.3 Teclado

- Ordem de foco = ordem visual. `:focus-visible` nunca removido sem substituto.
- Toda ação acessível sem mouse (menus, DnD do Studio, org switcher via `<details>`).
- `Esc` fecha drawer/menu; `Enter`/`Space` ativam controles custom.

### 11.4 Formulários (skill form-ux)

- Rótulo visível; `hint` antes do erro; erro com recuperação; dado preservado após erro
  recuperável; sem duplo submit; `type`/`inputmode` corretos; ações destrutivas nomeiam o
  objeto ("Excluir campanha 'X'").
- **Corrigir `login/page.tsx`** (placeholder-only) — Fase 0.

### 11.5 Leitor de tela / semântica

- `<html lang="pt-BR">` (já em `layout.tsx`).
- Landmarks: `<header>`, `<nav aria-label>`, `<main id="conteudo">`, `<footer>` (já no
  `PanelChrome`/`PublicShell`).
- Ordem de headings sem pular nível.
- `StatusBadge`, `DeltaBadge` com texto real (não emoji/seta solta).

---

## 12. Governança e entrega

### 12.1 Fonte única de token

**Hoje:** só `apps/web/src/app/globals.css` (`@theme`). E-mails e worker repetem hex.

**Proposta (mínima, sem framework):** criar **`packages/tokens`** — um pacote de workspace
com:

- `tokens.css` (ou um `@theme` parcial) — **não** duplicar; o `globals.css` continua sendo o
  lugar onde o Tailwind lê. Alternativa: manter tudo no `globals.css` e o pacote exportar só
  o que o e-mail precisa.
- `index.ts` exportando as constantes que vivem fora do CSS: `BRAND` (`#006b4f`), `INK_EMAIL`
  (`#2f3b37`), `MUTED_EMAIL` (`#8a938f`), `CANVAS` (`#f8f8f6`), `CARD_BORDER` (`#e5e7eb`),
  `CALLOUT_BG` (`#f2f7f4`), `DIVIDER` (`#e7e2d6`), `FONT_STACK_EMAIL`.

`packages/emails` passa a importar essas constantes em vez de literais locais em
`email-blocks.ts` (`BRAND/INK/MUTED`), `templates.ts` (`INK/MUTED` do `SHELL`) e `index.ts`
(`shell()`). O worker não muda (só reexporta via `@donation/emails`).

**Style Dictionary / build de token é overprojeto** para este tamanho — a regra da skill
design-system: reduzir entropia sem criar overhead de framework.

### 12.2 Camada de componente

`apps/web/src/components/ui/` permanece a camada única de primitivo. Ainda **não** promover a
pacote de workspace (`@donation/ui`) — só quando um segundo app precisar consumir. Enquanto
isso: barril `index.ts`, API pública pequena, sem lógica de domínio (o `StatusBadge` com
`STATUS_MAP` é o limite aceitável — é tradução de rótulo, não regra de negócio).

**Guarda de lint (Fase 3+):** regra simples de CI (grep ou `eslint-plugin-tailwindcss`)
proibindo, em `apps/web/src/app/**` e `apps/web/src/components/**` (fora de `ui/`):
hex cru (`#[0-9a-f]{3,6}`) e `text-\[\d` arbitrário. Força o uso de token + escala nomeada.

### 12.3 Style guide vivo

Rota proposta: **`apps/web/src/app/style-guide/page.tsx`** (fora do `panel/`, servida só fora
de produção — `if (process.env.NODE_ENV === "production") notFound()` — ou atrás de auth de
admin). Conteúdo:

- Paleta (todos os tokens) com leitura de contraste ao vivo sobre `#fff` e sobre `-bg`.
- Escala tipográfica (`text-display`…`text-eyebrow`) renderizada.
- Cada primitivo de `ui/` com **todos** os estados lado a lado (button ×4 variantes ×
  {default, hover simulado, focus, disabled, loading}; field × {default, error, success,
  disabled}; badges; StatusBadge com todo o `STATUS_MAP`; Alert ×4; EmptyState; Table densa e
  normal; Stat; SummaryStrip; Sparkline).
- Demo de motion (com botão "simular reduced-motion").
- Prévia do tema de inquilino: um seletor de acento aplicando o guarda-corpo do §6.3 aos
  blocos públicos.

É a **superfície de aceite** para visual-QA e para revisão de PR de UI.

### 12.4 Versionamento de token

- `packages/tokens` com **semver**. `CHANGELOG.md` curto.
- Mudança de **valor** de token = minor. **Remoção/renome** de token = major, e nunca sem um
  ciclo de alias `@deprecated` (comentário no `@theme` + no `index.ts`).
- Toda alteração de token passa pelo `/style-guide` antes do merge.

### 12.5 Consumo pelo worker / e-mails

`apps/worker` → `@donation/emails` → (depois da Fase 2) `@donation/tokens`. O worker nunca
importa CSS nem Tailwind; só as constantes hex e as funções de template já renderizadas para
string HTML (padrão atual, correto).

### 12.6 Roadmap em fases (sem big-bang)

| Fase | Tema | Esforço | Entregável independente |
| --- | --- | --- | --- |
| **0 — Fundação** | tokens que faltam (`--font-mono`, `--z-*`, `--duration-*`, `--ease-*`, `--radius-pill`, `--shadow-pop`, `-sunken/-overlay`), bloco `prefers-reduced-motion`, aliases semânticos; corrigir rótulos do login; tom `info` em `Alert`/`Badge` | baixo | `globals.css` + 5 arquivos |
| **1 — Contraste + acento do inquilino** | pass de contraste em `success`/`warn`/`danger-bg`; trocar `onAccent` por guarda-corpo WCAG + `accentInk` + rampa; canonizar `Organization.branding`; prévia + aviso no `ThemePanel` | médio | páginas públicas e Studio |
| **2 — Tokens compartilhados p/ e-mail** | criar `packages/tokens`; unificar os dois shells de e-mail; e-mails importam constantes; alinhar `#f4f4f5`→`canvas`; default de `logoUrl` | médio | pacote `emails` + worker inalterado |
| **3 — Primitivos** | `Button` `loading` + `size="icon"`/`IconButton`; estados de `Field` (invalid/success/required); `Alert` com title/icon/dismiss; `EmptyState` icon+action; `Table` densa/ordenável/sticky; `Skeleton`; lint anti-hex | médio/alto | `ui/` + call sites incrementais |
| **4 — Escala tipográfica + style guide** | `@utility` `text-*` nomeados; migrar `text-[...]` oportunista; publicar `/style-guide` | médio | novo route + migração incremental |
| **5 — Dark-ready (opcional)** | overrides `[data-theme="dark"]` no painel + toggle | alto | só painel; público e e-mail intocados |

Cada fase é mergeável sozinha; as páginas de feature continuam funcionando porque a API
pública dos primitivos não quebra.

---

## 13. Não-objetivos

- **Escolha final de nome e logo.** Este documento entrega o framework (§1.6/§1.7); a
  decisão depende de teste de domínio + INPI.
- **RLS, multi-tenant a nível de dados, segurança de rota.** Fora do escopo visual.
- **Deploy, infraestrutura, DNS, domínio próprio.** O produto roda em localhost.
- **Matriz de teste de clientes de e-mail** além do que o shell já cobre (Outlook/Word,
  Gmail).
- **Pacote `@donation/ui` publicado** e Storybook completo — o `/style-guide` interno basta
  para o tamanho atual.
- **Adoção de biblioteca de gráfico** (Recharts/visx) ou de **motion** (Framer Motion) —
  SVG/CSS dão conta.
- **i18n** além de pt-BR (o bloco `intlDonation` já existe com copy em inglês própria; não é
  um sistema de tradução).
- **Redesenho do modelo de interação do Studio** (DnD, painéis) — só a linguagem visual.
- **App nativo / mobile** — responsivo web apenas.
- **Certificação de acessibilidade por terceiro** — o alvo é AA verificável internamente.
- **Modo escuro entregue** — apenas "pronto para" (§10).

---

## 14. Arquivos concretos por fase

Caminhos relativos à raiz do monorepo. Todos foram inspecionados para este documento.

### Fase 0 — Fundação

- `apps/web/src/app/globals.css` — adicionar `--font-mono`, `--radius-pill`, `--shadow-pop`,
  `--color-surface-sunken/-overlay`, `--color-border(-strong)`, `--z-*`, `--duration-*`,
  `--ease-*`, aliases `--color-text/-muted/-subtle`, `--color-info`; bloco
  `@media (prefers-reduced-motion: reduce)`; comentário "decorativo, não-texto" em
  `--color-accent-*` e `--color-hairline`.
- `apps/web/src/components/ui/Page.tsx` — `Alert` ganha tom `info`.
- `apps/web/src/components/ui/Badge.tsx` — tom `info` no `Badge`; ajustar `STATUS_MAP`
  (ex.: `IN_REVIEW`, `SUBMITTED` → `info`).
- `apps/web/src/app/panel/login/page.tsx` — trocar `Input placeholder=` por
  `Field label=` (rótulo visível); idem em
  `apps/web/src/app/panel/register/page.tsx`, `.../forgot/page.tsx`, `.../reset/page.tsx`,
  `.../verify/page.tsx`.

### Fase 1 — Contraste + acento do inquilino

- `apps/web/src/app/globals.css` — novos hex de `--color-success` / `--color-warn` (texto de
  pílula) e/ou `-bg`; leve escurecimento de `--color-danger-bg`.
- `apps/web/src/blocks/render-static.tsx` — substituir `onAccent()` pelo par
  `onAccent()` (WCAG) + `accentInk()` + helpers de rampa (`accentWash/soft/hover/ring`);
  `hero` overlay mínimo 0.35 + scrim em gradiente; usar `accentInk` onde hoje o acento vira
  texto (`amountOptions` selecionado, `impactCounters`, aspas de `testimonials`,
  `matchBanner`).
- `apps/web/src/blocks/render.tsx` — alinhar leitura de acento (`branding.primaryColor`) ao
  nome canônico; passar os derivados no `StaticCtx`.
- `apps/web/src/blocks/context.ts` — canonizar o tipo `branding` (`{ primaryColor,
  buttonRadius, logoUrl }`; demais campos aceitos e ignorados).
- `apps/web/src/blocks/studio/ThemePanel.tsx` — prévia com botão + barra + `Stat`; aviso de
  contraste; reordenar `PRESETS`.
- `apps/web/src/blocks/studio/Studio.tsx` — tipo `Theme` alinhado ao canônico.
- `apps/web/src/server/campaigns/actions.ts` — `saveOrgTheme` grava a chave canônica.
- `apps/web/src/components/public/PublicShell.tsx` — usar `accentInk` no quadrado da inicial
  quando o acento for claro.

### Fase 2 — Tokens compartilhados para e-mail

- **novo** `packages/tokens/package.json`, `packages/tokens/src/index.ts` (constantes hex +
  stacks de fonte), `packages/tokens/CHANGELOG.md`.
- `packages/emails/src/email-blocks.ts` — importar `BRAND/INK/MUTED/CALLOUT_BG/DIVIDER` de
  `@donation/tokens` em vez das `const` locais.
- `packages/emails/src/templates.ts` — `SHELL` importa cores/borda/fonte do pacote;
  consolidar com `index.ts`.
- `packages/emails/src/index.ts` — remover `shell()` duplicado, reexportar o `SHELL` único;
  cores do pacote; alinhar `#f4f4f5` → `CANVAS`.
- `apps/web/src/app/globals.css` — `--color-canvas` passa a ser o mesmo valor exportado pelo
  pacote (documentar a relação).
- `apps/worker/src/**` (consumidores de `@donation/emails`: `donations.ts`,
  `processors/{lifecycle,recurring,auction,broadcast,segment-automations,team-digest,`
  `annual-statements,ambassador-welcome,event-reminders}.ts`) — **sem alteração**; herdam via
  reexport.

### Fase 3 — Primitivos

- `apps/web/src/components/ui/Button.tsx` — prop `loading` (spinner `Loader2` + `aria-busy`),
  `size: "sm" | "md" | "icon"`; `apps/web/src/components/ui/index.ts` reexporta `IconButton`
  se for componente separado.
- `apps/web/src/components/ui/Field.tsx` — `aria-invalid`/`aria-describedby`, borda de erro
  no `.input` via `data-invalid`, estado `success`, indicador `required`.
- `apps/web/src/components/ui/Page.tsx` — `Alert` com `title`/`icon`/`onDismiss`;
  `EmptyState` com `icon`/`action`; **novo** `Skeleton`.
- `apps/web/src/components/ui/Table.tsx` — variante `dense`, `Th` `sortable` + `aria-sort`,
  `sticky` opcional, helper `align`.
- `apps/web/src/app/globals.css` — `.input[data-invalid]`, `.skeleton`, `.btn` usando
  `--radius-pill` e `--duration-fast`.
- Call sites que trocam o hack manual pelo primitivo: `apps/web/src/app/panel/login/page.tsx`
  (Button `loading`), `apps/web/src/blocks/studio/Studio.tsx` (save state),
  `apps/web/src/app/panel/orgs/[orgId]/domains/page.tsx` (Field loading/success).
- CI: regra anti-hex / anti-`text-[` (config de lint na raiz ou `apps/web`).

### Fase 4 — Escala tipográfica + style guide

- `apps/web/src/app/globals.css` — `@utility text-display/title/heading/subhead/body/ui/`
  `caption/eyebrow/num` (o `eyebrow` já existe; realinhar).
- `apps/web/src/components/ui/*` — `PageHeader`, `Card`, `Stat`, `SummaryStrip` passam a usar
  as utilities nomeadas em vez de `text-2xl`/`text-[1.375rem]`/`text-[0.8125rem]`.
- **novo** `apps/web/src/app/style-guide/page.tsx` (+ componentes de apoio em
  `apps/web/src/app/style-guide/`), com `notFound()` em produção.
- Migração incremental das páginas em `apps/web/src/app/panel/**` (trocar tamanhos
  arbitrários — sem prazo único).

### Fase 5 — Dark-ready (opcional)

- `apps/web/src/app/globals.css` — bloco `[data-theme="dark"]` sobrescrevendo os aliases
  semânticos de `--color-surface*`, `--color-text*`, `--color-border*`.
- `apps/web/src/app/layout.tsx` — ler preferência (cookie) e setar `data-theme` no `<html>`.
- `apps/web/src/components/PanelChrome.tsx` — toggle de tema no header (só painel).
- **não tocar**: `packages/emails/**`, `apps/web/src/blocks/**`, `PublicShell.tsx`.
