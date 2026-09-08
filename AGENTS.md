# Desenvolvimento com economia de modelos

## Escolha de modelo

Use o menor modelo adequado ao risco e à ambiguidade. As escolhas abaixo são
uma política do projeto, não equivalências exatas entre modelos da Anthropic e OpenAI.
Uma seleção explícita do usuário tem prioridade.

| Trabalho | Modelo | Esforço |
| --- | --- | --- |
| Leitura pontual, tarefa mecânica e escopo claro | `gpt-5.6-luna` | low ou medium |
| Implementação cotidiana e revisão delimitada | `gpt-5.6-terra` | medium |
| UI complexa, diagnóstico e revisão especializada | `gpt-5.6-sol` | high |
| Arquitetura complexa, decisão de alto impacto e impasse comprovado | `gpt-6-astra` | high |

Os nomes históricos `planner-opus`, `coder-sonnet` e `reviewer-sonnet` são papéis;
eles executam os modelos OpenAI selecionados por esta política. Quando a configuração
local `.codex` puder ser editada, os mesmos valores podem ser fixados em
`.codex/config.toml` e `.codex/agents/*.toml`.
Não presumir que este arquivo troca o modelo da conversa atual ou que existe
um modo nativo `opusplan` no Codex. A seleção do aplicativo pode prevalecer.

## Delegação e economia

- Resolva tarefas pequenas diretamente, sem iniciar uma equipe para cada ajuste.
- Para trabalho complexo, use subagentes apenas para subtarefas concretas que
  possam avançar junto com trabalho útil do agente principal, quando a sessão permitir.
- Prefira um especialista por necessidade real e no máximo dois subagentes simultâneos.
- Planejamento complexo: `planner-opus`; execução delimitada: `coder-sonnet`;
  revisão relevante: `reviewer-sonnet`. Acione outros especialistas só pelo risco observado.
- Ao selecionar modelo explicitamente na ferramenta de delegação, use a tabela;
  se a ferramenta não aceitar troca com histórico completo, envie contexto mínimo
  autocontido com `fork_turns="none"`. Nunca alegue ter trocado sem confirmação.
- Cada executor deve receber objetivo, arquivos sob sua responsabilidade, critérios
  de aceite e aviso de que há outros agentes trabalhando. Não repetir a mesma análise.
- Reaproveite agentes existentes. Devolva evidências e conclusões curtas, não arquivos inteiros.
- Escale de modelo após falha com causa ainda incerta, ou antes de decisões complexas
  com alto impacto. Não aumente custo automaticamente por quota ou indisponibilidade;
  informe a limitação. Não reduzir rigor em autenticação, dados ou migrações para economizar.
- Procure primeiro com `rg`; leia apenas arquivos e skills relevantes. Evite carregar
  catálogos, dependências, históricos e diretórios inteiros sem necessidade.
- Valide a alteração com os comandos pertinentes disponíveis no `package.json`.
  Prefira verificações focadas; use `pnpm typecheck`, `pnpm test`, `pnpm lint:tokens`
  e `pnpm build` conforme o impacto. Não repetir verificações aprovadas sem mudança
  ou nova evidência, nem exigir build para alterações só de documentação/configuração de agentes.
- Informe resultado, verificações e limitações reais. Não inventar percentuais de economia.

## Regras de desenvolvimento preservadas do Claude

- Confira `git status` antes de alterações amplas; preserve trabalho alheio e revise o diff.
- Faça mudanças pontuais, reutilizando padrões, componentes e utilitários existentes.
- Preserve tipos TypeScript e a arquitetura atual. Evite `any`, dependências e abstrações sem necessidade.
- Mantenha segredos e acesso privilegiado no servidor; evite APIs de navegador no SSR.
- Não leia nem exponha `.env`, credenciais, tokens ou chaves privadas. Use exemplos sem segredos.
- Valide entradas externas e permissões no servidor; não confie na visibilidade da interface.
- Preserve transações e use idempotência onde repetições causariam efeitos indevidos.
- Não desative TLS, autenticação ou validação para contornar falhas.
- Na interface, reutilize tokens e componentes; preserve hierarquia, semântica, foco,
  rótulos, responsividade e estados de carregamento, vazio, erro e desabilitado.
- Investigue desempenho com evidências antes de otimizar; preserve correção e acessibilidade.
- Teste comportamento observável, permissões e transições relevantes com dados realistas;
  evite testes que apenas espelham implementação e esperas arbitrárias.

As bibliotecas de skills estão em `.agents/skills`. Consulte somente as necessárias.
As regras do `.claude` foram adaptadas acima: permissões de Claude não são controles
de sandbox do Codex. Respeite sempre as permissões efetivas da sessão.
