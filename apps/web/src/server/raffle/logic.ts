import { createHash } from "node:crypto";

/**
 * Pure raffle helpers — number allocation and the auditable draw.
 * Side-effect free so they can be unit tested and reproduced by anyone.
 */

/** Deterministic <2^52 unsigned int from a string. */
function seedInt(seed: string): number {
  return Number.parseInt(createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 13), 16);
}

/** Deterministic xorshift PRNG seeded from `seed`. */
function makeRng(seed: string): () => number {
  let s = seedInt(seed) % 0xffffffff || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

/**
 * Choose `quantity` free numbers in [1, total], excluding `taken`.
 * `seed` makes the pick reproducible. Throws if not enough free numbers.
 */
export function pickFreeNumbers(total: number, taken: Iterable<number>, quantity: number, seed?: string): number[] {
  if (!Number.isInteger(total) || total < 1) throw new RangeError("total must be a positive integer");
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("quantity must be a positive integer");

  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const free: number[] = [];
  for (let n = 1; n <= total; n++) if (!takenSet.has(n)) free.push(n);
  if (free.length < quantity) throw new RangeError(`only ${free.length} numbers available, need ${quantity}`);

  const rng = seed ? makeRng(seed) : Math.random;
  for (let i = 0; i < quantity; i++) {
    const j = i + Math.floor(rng() * (free.length - i));
    [free[i], free[j]] = [free[j]!, free[i]!];
  }
  return free.slice(0, quantity).sort((a, b) => a - b);
}

/** Validate an explicit number selection against range + already-taken. */
export function validateNumberSelection(
  total: number,
  taken: Iterable<number>,
  wanted: number[],
): { ok: true } | { ok: false; reason: string } {
  if (wanted.length === 0) return { ok: false, reason: "Selecione ao menos um número" };
  const seen = new Set<number>();
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  for (const n of wanted) {
    if (!Number.isInteger(n) || n < 1 || n > total) return { ok: false, reason: `Número fora do intervalo: ${n}` };
    if (seen.has(n)) return { ok: false, reason: `Número repetido: ${n}` };
    if (takenSet.has(n)) return { ok: false, reason: `Número já vendido: ${n}` };
    seen.add(n);
  }
  return { ok: true };
}

/**
 * The draw: an index into the sorted list of paid ticket numbers.
 * `idx = sha256(seed) mod paidCount` — anyone can recompute it.
 */
export function drawWinnerIndex(seed: string, paidCount: number): number {
  if (!Number.isInteger(paidCount) || paidCount < 1) throw new RangeError("paidCount must be >= 1");
  return seedInt(seed) % paidCount;
}
