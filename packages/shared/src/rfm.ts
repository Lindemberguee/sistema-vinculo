/**
 * RFM segmentation — pure scoring over a donor population.
 * The worker pulls the raw R/F/M values per org and calls `scorePopulation`.
 */

export interface RfmMetrics {
  /** Days since the donor's last paid donation (lower = better). */
  recencyDays: number;
  /** Number of paid donations (higher = better). */
  frequency: number;
  /** Total donated in cents (higher = better). */
  monetaryCents: number;
}

export type RfmSegment =
  | "Campeões"
  | "Fiéis"
  | "Potenciais"
  | "Novos"
  | "Promissores"
  | "Atenção"
  | "Em risco"
  | "Hibernando"
  | "Perdidos";

export interface RfmScore {
  r: 1 | 2 | 3 | 4 | 5;
  f: 1 | 2 | 3 | 4 | 5;
  m: 1 | 2 | 3 | 4 | 5;
  segment: RfmSegment;
}

/** Quintile rank (1..5) of `value` within `sorted` (ascending). */
function quintile(sorted: number[], value: number): 1 | 2 | 3 | 4 | 5 {
  if (sorted.length === 0) return 3;
  // position = share of population strictly below `value`
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  const pct = lo / sorted.length;
  const rank = Math.min(5, Math.floor(pct * 5) + 1);
  return rank as 1 | 2 | 3 | 4 | 5;
}

function segmentFor(r: number, f: number, m: number): RfmSegment {
  const fm = Math.round((f + m) / 2);
  if (r >= 4 && fm >= 4) return "Campeões";
  if (r >= 3 && fm >= 4) return "Fiéis";
  if (r >= 4 && fm >= 2) return "Potenciais";
  if (r === 5 && fm <= 1) return "Novos";
  if (r >= 3 && fm <= 2) return "Promissores";
  if (r === 3 && fm === 3) return "Atenção";
  if (r <= 2 && fm >= 3) return "Em risco";
  if (r <= 2 && fm === 2) return "Hibernando";
  return "Perdidos";
}

export function scorePopulation(pop: RfmMetrics[]): RfmScore[] {
  if (pop.length === 0) return [];
  // recency: lower is better, so invert by ranking ascending then flipping
  const recAsc = [...pop.map((p) => p.recencyDays)].sort((a, b) => a - b);
  const freqAsc = [...pop.map((p) => p.frequency)].sort((a, b) => a - b);
  const monAsc = [...pop.map((p) => p.monetaryCents)].sort((a, b) => a - b);

  return pop.map((p) => {
    const rRaw = quintile(recAsc, p.recencyDays);
    const r = (6 - rRaw) as 1 | 2 | 3 | 4 | 5; // recent => high score
    const f = quintile(freqAsc, p.frequency);
    const m = quintile(monAsc, p.monetaryCents);
    return { r, f, m, segment: segmentFor(r, f, m) };
  });
}
