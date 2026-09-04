import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "info" | "success" | "warn" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "badge-neutral",
  info: "badge-info",
  success: "badge-success",
  warn: "badge-warn",
  danger: "badge-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn(toneClass[tone])}>{children}</span>;
}

/**
 * Single source of truth for domain-status pills across the panel.
 * Covers campaigns, KYC, donations, recurring plans, and the Phase 6 modules
 * (rifa, eventos, leilão, apadrinhamento) so pages never render a raw enum.
 */
const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Campaign / generic lifecycle
  DRAFT: { label: "Rascunho", tone: "neutral" },
  PUBLISHED: { label: "Publicada", tone: "success" },
  PAUSED: { label: "Pausada", tone: "warn" },
  CLOSED: { label: "Encerrada", tone: "neutral" },
  OPEN: { label: "Aberta", tone: "success" },
  ENDED: { label: "Encerrado", tone: "warn" },
  // Organization
  ACTIVE: { label: "Ativa", tone: "success" },
  PENDING_KYC: { label: "Aguardando aprovação", tone: "warn" },
  SUSPENDED: { label: "Suspensa", tone: "danger" },
  // Donation
  PAID: { label: "Paga", tone: "success" },
  PENDING: { label: "Pendente", tone: "warn" },
  FAILED: { label: "Falhou", tone: "danger" },
  EXPIRED: { label: "Expirada", tone: "neutral" },
  REFUNDED: { label: "Estornada", tone: "neutral" },
  CHARGED_BACK: { label: "Chargeback", tone: "danger" },
  // Recurring plan
  PAST_DUE: { label: "Pagamento pendente", tone: "warn" },
  CANCELED: { label: "Cancelada", tone: "neutral" },
  // KYC
  DELIVERED: { label: "Entregue", tone: "success" },
  APPROVED: { label: "Aprovado", tone: "success" },
  REJECTED: { label: "Recusado", tone: "danger" },
  IN_REVIEW: { label: "Em análise", tone: "info" },
  SUBMITTED: { label: "Enviado", tone: "info" },
  NOT_STARTED: { label: "Não iniciado", tone: "neutral" },
  // Rifa
  DRAWN: { label: "Sorteada", tone: "neutral" },
  // Leilão
  SETTLED: { label: "Concluído", tone: "neutral" },
  // Ingressos
  VALID: { label: "Válido", tone: "success" },
  USED: { label: "Utilizado", tone: "neutral" },
  RESERVED: { label: "Reservado", tone: "warn" },
  // Apadrinhamento
  AVAILABLE: { label: "Disponível", tone: "warn" },
  SPONSORED: { label: "Apadrinhado", tone: "success" },
  RETIRED: { label: "Arquivado", tone: "neutral" },
};

/** Maps a domain status enum to a translated label + tone. */
export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
