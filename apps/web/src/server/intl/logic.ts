export const INTL_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
export type IntlCurrency = (typeof INTL_CURRENCIES)[number];

export function isIntlCurrency(c: string): c is IntlCurrency {
  return (INTL_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}

/** Friendly per-currency minimum donation, in minor units (all ~5.00). */
export function minAmountMinor(currency: IntlCurrency): number {
  return 500;
}

export function validateIntlAmount(
  currency: string,
  amountMinor: number,
): { ok: true; currency: IntlCurrency } | { ok: false; reason: string } {
  const up = currency.toUpperCase();
  if (!isIntlCurrency(up)) return { ok: false, reason: "Moeda não suportada" };
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return { ok: false, reason: "Valor inválido" };
  if (amountMinor > 100_000_00) return { ok: false, reason: "Valor acima do limite" };
  if (amountMinor < minAmountMinor(up)) return { ok: false, reason: `Mínimo ${minAmountMinor(up) / 100} ${up}` };
  return { ok: true, currency: up };
}

/** Format minor units in the given currency. */
export function formatIntl(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amountMinor / 100);
}
