"use client";

import { useState } from "react";
import { formatBRL } from "@donation/shared";
import { Card, CardBody, Button, StatusBadge, cn } from "@/components/ui";

export function KycCard({
  orgStatus,
  kycStatus,
  docCount,
}: {
  orgStatus: string;
  kycStatus: string;
  docCount: number;
}) {
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 text-base font-semibold">Verificação (KYC)</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Situação da organização</dt>
          <dd>
            <StatusBadge status={orgStatus} />
          </dd>
          <dt className="text-muted">Status do KYC</dt>
          <dd>
            <StatusBadge status={kycStatus} />
          </dd>
          <dt className="text-muted">Documentos enviados</dt>
          <dd>{docCount}</dd>
        </dl>
        <p className="mt-3 text-sm text-muted">
          A conta de pagamentos é própria da organização. Conecte ou revise-a em <strong>Pagamentos</strong>;
          o KYC da plataforma é analisado manualmente pela equipe.
        </p>
      </CardBody>
    </Card>
  );
}

export function PlanSelector({
  currentPlanId,
  plans,
}: {
  currentPlanId: string;
  plans: { id: string; name: string; monthlyCents: number }[];
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 text-base font-semibold">Plano</h2>
        <div className="grid gap-2">
          {plans.map((p) => {
            const active = p.id === currentPlanId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  active ? "border-brand-600 bg-brand-50/40" : "border-line",
                )}
              >
                <div>
                  <strong className="text-sm">{p.name}</strong>
                  <div className="text-xs text-muted">
                    {p.monthlyCents === 0 ? "Sem mensalidade" : `${formatBRL(p.monthlyCents)}/mês`} · sem taxa da plataforma por doação
                  </div>
                </div>
                {active ? (
                  <span className="text-xs text-success">Plano atual</span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setError("Solicite a mudança à equipe após confirmar a mensalidade.")}>
                    Solicitar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="mt-2 field-error">{error}</p>}
        <p className="mt-2 hint">A mensalidade é fixa e não há taxa da plataforma por doação. A mudança de plano é confirmada pela equipe após a contratação.</p>
      </CardBody>
    </Card>
  );
}
