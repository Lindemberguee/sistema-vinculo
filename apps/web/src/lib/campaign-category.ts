/** pt-BR labels for the CampaignCategory enum. */
export const CAMPAIGN_CATEGORIES: { value: string; label: string }[] = [
  { value: "NONE", label: "Sem categoria" },
  { value: "CHILDREN", label: "Crianças e adolescentes" },
  { value: "HEALTH", label: "Saúde" },
  { value: "ENVIRONMENT", label: "Meio ambiente" },
  { value: "HUMAN_RIGHTS", label: "Direitos humanos" },
  { value: "ANIMALS", label: "Animais" },
  { value: "EDUCATION", label: "Educação" },
  { value: "SPORTS", label: "Esporte" },
  { value: "COMMUNITY", label: "Desenvolvimento comunitário" },
  { value: "ENTREPRENEURSHIP", label: "Empreendedorismo" },
  { value: "SPIRITUALITY", label: "Espiritualidade" },
  { value: "CULTURE", label: "Cultura e arte" },
  { value: "PUBLIC_POLICY", label: "Políticas públicas" },
];

const BY_VALUE = Object.fromEntries(CAMPAIGN_CATEGORIES.map((c) => [c.value, c.label]));
export const categoryLabel = (v: string) => BY_VALUE[v] ?? v;
