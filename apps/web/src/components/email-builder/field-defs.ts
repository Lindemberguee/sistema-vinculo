import type { EmailBlockType } from "@donation/emails";

export type FieldKind =
  | "text"
  | "line" // single-line HTML (inline formatting allowed)
  | "rich" // multi-line HTML (inline formatting allowed)
  | "url"
  | "color"
  | "select"
  | "number"
  | "image"
  | "detailFields";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  options?: { value: string; label: string }[];
}

const ALIGN: FieldDef = {
  name: "align",
  label: "Alinhamento",
  kind: "select",
  options: [
    { value: "left", label: "Esquerda" },
    { value: "center", label: "Centro" },
    { value: "right", label: "Direita" },
  ],
};

export const BLOCK_FIELDS: Record<EmailBlockType, FieldDef[]> = {
  heading: [
    { name: "text", label: "Texto", kind: "text", hint: "Aceita variáveis, ex.: Olá, {NOME}" },
    {
      name: "level",
      label: "Tamanho",
      kind: "select",
      options: [
        { value: "h1", label: "Grande (título)" },
        { value: "h2", label: "Médio (subtítulo)" },
        { value: "h3", label: "Pequeno" },
      ],
    },
    ALIGN,
    { name: "color", label: "Cor do texto", kind: "color" },
  ],
  text: [
    {
      name: "html",
      label: "Conteúdo",
      kind: "rich",
      hint: "Use **negrito**, *itálico* e links pela barra. Variáveis como {NOME} funcionam.",
    },
    {
      name: "size",
      label: "Tamanho da fonte",
      kind: "select",
      options: [
        { value: "sm", label: "Pequena" },
        { value: "md", label: "Normal" },
        { value: "lg", label: "Grande" },
      ],
    },
    ALIGN,
    { name: "color", label: "Cor do texto", kind: "color" },
  ],
  button: [
    { name: "label", label: "Texto do botão", kind: "text" },
    { name: "href", label: "Link", kind: "url", hint: "Cole um link ou use uma variável como {LINK}." },
    ALIGN,
    { name: "bg", label: "Cor de fundo", kind: "color" },
    { name: "color", label: "Cor do texto", kind: "color" },
    {
      name: "radius",
      label: "Cantos",
      kind: "select",
      options: [
        { value: "full", label: "Arredondado" },
        { value: "md", label: "Suave" },
        { value: "none", label: "Reto" },
      ],
    },
  ],
  image: [
    { name: "src", label: "Imagem", kind: "image" },
    { name: "alt", label: "Texto alternativo", kind: "text", hint: "Descrição curta para leitores de tela." },
    { name: "href", label: "Link ao clicar (opcional)", kind: "url" },
    { name: "width", label: "Largura (px)", kind: "number", hint: "Entre 40 e 560." },
    ALIGN,
  ],
  divider: [
    { name: "color", label: "Cor da linha", kind: "color" },
    { name: "gap", label: "Espaço acima/abaixo (px)", kind: "number" },
  ],
  spacer: [{ name: "height", label: "Altura (px)", kind: "number", hint: "Entre 4 e 96." }],
  callout: [
    { name: "html", label: "Conteúdo", kind: "rich" },
    ALIGN,
    { name: "bg", label: "Cor de fundo", kind: "color" },
    { name: "color", label: "Cor do texto", kind: "color" },
  ],
  donationDetails: [
    {
      name: "fields",
      label: "Linhas exibidas",
      kind: "detailFields",
      hint: "Cada linha usa o valor real da doação no envio.",
    },
  ],
  footer: [
    { name: "text", label: "Texto", kind: "text" },
    { name: "color", label: "Cor do texto", kind: "color" },
  ],
  html: [
    {
      name: "html",
      label: "HTML",
      kind: "rich",
      hint: "Para quem sabe HTML. Scripts e estilos externos são removidos.",
    },
  ],
};

export const DETAIL_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "VALOR", label: "Valor da doação" },
  { value: "TOTAL", label: "Total pago" },
  { value: "METODO", label: "Forma de pagamento" },
  { value: "DATA", label: "Data" },
  { value: "CAMPANHA", label: "Campanha" },
];
