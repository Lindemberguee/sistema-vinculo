import type { ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "./cn";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2.5 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          <span aria-hidden>‹</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-title">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  action,
  children,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-canvas text-muted" aria-hidden>
          {icon}
        </div>
      )}
      {title && <p className="text-sm font-semibold text-ink">{title}</p>}
      <div className={cn("text-sm text-muted", title && "mt-1")}>{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Loading placeholder. Purely decorative — always `aria-hidden`. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

/* ── Sparkline (inline SVG, no chart lib) ─────────────────────────── */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const w = 120;
  const h = 34;
  if (data.length < 2) return <div className={cn("h-[34px]", className)} />;
  const max = Math.max(...data, 1);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-[34px] w-full", className)} aria-hidden>
      <polygon points={area} fill="var(--color-brand-500)" fillOpacity="0.08" />
      <polyline points={line} fill="none" stroke="var(--color-brand-500)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-faint">—</span>;
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold",
        up ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
      )}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "aumento de " : "queda de "}</span>
      {Math.abs(pct).toFixed(1).replace(".", ",")}%
    </span>
  );
}

const DOT_TONE: Record<string, string> = {
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  success: "bg-success",
  warn: "bg-warn",
  neutral: "bg-faint",
};

export function Stat({
  label,
  value,
  dot = "brand",
  deltaPct,
  sub,
  spark,
}: {
  label: string;
  value: ReactNode;
  dot?: keyof typeof DOT_TONE;
  deltaPct?: number | null;
  sub?: ReactNode;
  spark?: number[];
}) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", DOT_TONE[dot])} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mt-2 text-num text-[1.375rem]">{value}</div>
      {(deltaPct !== undefined || sub) && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          {deltaPct !== undefined && <DeltaBadge pct={deltaPct ?? null} />}
          {sub && <span>{sub}</span>}
        </div>
      )}
      {spark && spark.length > 1 && (
        <div className="mt-3">
          <Sparkline data={spark} />
        </div>
      )}
    </div>
  );
}

export function Alert({
  tone = "warn",
  title,
  icon,
  onDismiss,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  title?: ReactNode;
  icon?: ReactNode;
  onDismiss?: () => void;
  children?: ReactNode;
}) {
  const cls = {
    info: "bg-info-bg text-info",
    warn: "bg-warn-bg text-warn",
    danger: "bg-danger-bg text-danger",
    success: "bg-success-bg text-success",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-lg px-4 py-3 text-sm", cls)}>
      {icon && (
        <span className="mt-0.5 shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
