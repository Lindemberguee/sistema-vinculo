import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SummarySegment {
  label: string;
  value: number;
  /** Tailwind background utility for the bar + legend dot, e.g. "bg-brand-500". */
  color: string;
}

/**
 * Compact headline for list pages: a row of divider-separated stats and an
 * optional stacked composition bar with a dot legend (Doare "Transações" style).
 */
export function SummaryStrip({
  stats,
  segments,
  className,
}: {
  stats: { label: string; value: ReactNode }[];
  segments?: SummarySegment[];
  className?: string;
}) {
  const total = segments?.reduce((s, x) => s + x.value, 0) ?? 0;

  return (
    <div className={cn("card p-4 sm:p-5", className)} role="group" aria-label="Resumo">
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:flex sm:flex-wrap sm:gap-y-3 sm:[&>*+*]:ml-8 sm:[&>*+*]:border-l sm:[&>*+*]:border-line sm:[&>*+*]:pl-8">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="eyebrow">{s.label}</dt>
            <dd className="mt-0.5 truncate text-num text-lg">{s.value}</dd>
          </div>
        ))}
      </dl>

      {segments && total > 0 && (
        <>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-canvas">
            {segments.map((seg) => (
              <div
                key={seg.label}
                className={seg.color}
                style={{ width: `${(seg.value / total) * 100}%` }}
                title={`${seg.label}: ${seg.value}`}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {segments.map((seg) => (
              <li key={seg.label} className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", seg.color)} />
                {seg.label} <span className="font-medium text-ink">{Math.round((seg.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
