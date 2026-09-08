/**
 * Browser-side card tokenization. Raw card data goes straight from the browser
 * to Pagar.me and never touches our server (keeps us in PCI SAQ-A scope).
 *
 * The token carries the billing address too — Pagar.me's acquirer rejects a
 * card charge without one (`validation_error | billing | "value" is required`).
 */

export interface CardBillingAddress {
  /** "<número>, <rua>, <bairro>" */
  line1: string;
  line2?: string;
  /** Digits only (8). */
  zipCode: string;
  city: string;
  /** 2-letter UF. */
  state: string;
}

export interface CardData {
  number: string;
  holderName: string;
  /** Cardholder CPF/CNPJ, digits only — recommended by the acquirer. */
  holderDocument?: string;
  expMonth: number;
  expYear: number;
  cvv: string;
  billingAddress: CardBillingAddress;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/** Luhn checksum. */
function luhnValid(pan: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let d = pan.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Client-side pre-flight so an obviously bad card never becomes a wasted
 * tokenization + failed charge. Returns a PT message or null when OK.
 */
export function validateCard(card: CardData): string | null {
  const pan = onlyDigits(card.number);
  if (pan.length < 13 || pan.length > 19 || !luhnValid(pan)) return "Número do cartão inválido.";
  if (card.holderName.trim().length < 2) return "Informe o nome impresso no cartão.";
  if (!Number.isInteger(card.expMonth) || card.expMonth < 1 || card.expMonth > 12) return "Mês de validade inválido.";

  let year = card.expYear;
  if (year < 100) year += 2000;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return "Ano de validade inválido.";
  const now = new Date();
  const lastDayOfExpiry = new Date(year, card.expMonth, 0, 23, 59, 59);
  if (lastDayOfExpiry < now) return "Cartão vencido.";

  if (!/^\d{3,4}$/.test(card.cvv)) return "CVV inválido.";

  const doc = card.holderDocument ? onlyDigits(card.holderDocument) : "";
  if (doc && doc.length !== 11 && doc.length !== 14) return "CPF/CNPJ do titular inválido.";

  const a = card.billingAddress;
  if (onlyDigits(a.zipCode).length !== 8) return "CEP de cobrança inválido.";
  if (a.line1.trim().length < 3) return "Endereço de cobrança incompleto.";
  if (a.city.trim().length < 2) return "Cidade de cobrança inválida.";
  if (!/^[A-Za-z]{2}$/.test(a.state.trim())) return "UF de cobrança inválida.";
  return null;
}

export async function tokenizeCard(publicKey: string, card: CardData): Promise<string> {
  const a = card.billingAddress;
  const res = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(publicKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: onlyDigits(card.number),
        holder_name: card.holderName.trim(),
        ...(card.holderDocument ? { holder_document: onlyDigits(card.holderDocument) } : {}),
        exp_month: card.expMonth,
        exp_year: card.expYear,
        cvv: card.cvv,
        billing_address: {
          line_1: a.line1.trim(),
          ...(a.line2?.trim() ? { line_2: a.line2.trim() } : {}),
          zip_code: onlyDigits(a.zipCode),
          city: a.city.trim(),
          state: a.state.trim().toUpperCase().slice(0, 2),
          country: "BR",
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao validar o cartão: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Token de cartão não retornado pelo provedor");
  return json.id;
}

/** ViaCEP lookup for the billing-address auto-fill. Returns null on any failure. */
export async function lookupCep(
  cep: string,
): Promise<{ street: string; neighborhood: string; city: string; state: string } | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (j.erro) return null;
    return {
      street: j.logradouro ?? "",
      neighborhood: j.bairro ?? "",
      city: j.localidade ?? "",
      state: j.uf ?? "",
    };
  } catch {
    return null;
  }
}
