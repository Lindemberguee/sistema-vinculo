/** UN Sustainable Development Goals — number + short pt-BR label. */
export const SDG_GOALS: { n: number; label: string }[] = [
  { n: 1, label: "Erradicação da pobreza" },
  { n: 2, label: "Fome zero e agricultura sustentável" },
  { n: 3, label: "Saúde e bem-estar" },
  { n: 4, label: "Educação de qualidade" },
  { n: 5, label: "Igualdade de gênero" },
  { n: 6, label: "Água potável e saneamento" },
  { n: 7, label: "Energia acessível e limpa" },
  { n: 8, label: "Trabalho decente e crescimento econômico" },
  { n: 9, label: "Indústria, inovação e infraestrutura" },
  { n: 10, label: "Redução das desigualdades" },
  { n: 11, label: "Cidades e comunidades sustentáveis" },
  { n: 12, label: "Consumo e produção responsáveis" },
  { n: 13, label: "Ação contra a mudança global do clima" },
  { n: 14, label: "Vida na água" },
  { n: 15, label: "Vida terrestre" },
  { n: 16, label: "Paz, justiça e instituições eficazes" },
  { n: 17, label: "Parcerias e meios de implementação" },
];

const SDG_BY_N = Object.fromEntries(SDG_GOALS.map((g) => [g.n, g.label]));
export const sdgLabel = (n: number) => SDG_BY_N[n] ?? `ODS ${n}`;

export const BIOMES = [
  "Amazônia",
  "Caatinga",
  "Cerrado",
  "Mata Atlântica",
  "Pampa",
  "Pantanal",
  "Zona costeira e marinha",
  "Área urbana",
];

export const IMPACT_FOCUS = [
  "Educação",
  "Saúde",
  "Segurança alimentar",
  "Renda e trabalho",
  "Moradia",
  "Direitos e cidadania",
  "Meio ambiente e clima",
  "Cultura e esporte",
  "Assistência social",
];
