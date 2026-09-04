/**
 * All monetary values in this codebase are integer **cents** (BRL).
 * Never use floats for money. These helpers exist so intent is explicit
 * at call sites and formatting stays consistent.
 */

export type Cents = number;

export function isValidCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function assertCents(value: unknown, label = "amount"): asserts value is Cents {
  if (!isValidCents(value)) {
    throw new RangeError(`${label} must be a non-negative integer of cents, got ${String(value)}`);
  }
}

/** 1990 -> "R$ 19,90" */
export function formatBRL(cents: Cents): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "19,90" | "19.90" | "R$ 19,90" -> 1990. Throws on garbage. */
export function parseBRLToCents(input: string): Cents {
  const cleaned = input
    .replace(/[R$\s ]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // thousands separator
    .replace(",", ".");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new RangeError(`Cannot parse "${input}" as BRL`);
  return Math.round(value * 100);
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}
