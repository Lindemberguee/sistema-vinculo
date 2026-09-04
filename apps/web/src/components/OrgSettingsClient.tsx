"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@donation/shared";
import { refreshKycStatus } from "@/server/onboarding/actions";
import { changePlan } from "@/server/billing/actions";
import { Card, CardBody, Button, StatusBadge, cn } from "@/components/ui";

export function KycCard({
  orgId,
  orgStatus,
  kycStatus,
  docCount,
  hasRecipient,
}: {
  orgId: string;
  orgStatus: string;
  kycStatus: string;
  docCount: number;
  hasRecipient: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

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
          <dt className="text-muted">Recebedor no gateway</dt>
          <dd>{hasRecipient ? "criado" : "pendente"}</dd>
        </dl>
        {orgStatus !== "ACTIVE" && (
          <div className="mt-3">
            <Button
              size="sm"
              disabled={pending || !hasRecipient}
              onClick={() =>
                start(async () => {
                  const r = await refreshKycStatus(orgId);
                  setMsg(r.ok ? "Status atualizado." : (r.error ?? "Falha ao consultar"));
                  router.refresh();
                })
              }
            >
              {pending ? "Consultando…" : "Verificar status agora"}
            </Button>
          </div>
        )}
        {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
      </CardBody>
    </Card>
  );
}

export function PlanSelector({
  orgId,
  currentPlanId,
  plans,
}: {
  orgId: string;
  currentPlanId: string;
  plans: { id: string; name: string; monthlyCents: number; platformFeeBps: number }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
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
                    {p.monthlyCents === 0 ? "Grátis" : `${formatBRL(p.monthlyCents)}/mês`} ·{" "}
                    {(p.platformFeeBps / 100).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}% por doação
                  </div>
                </div>
                {active ? (
                  <span className="text-xs text-success">Plano atual</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await changePlan(orgId, p.id);
                        if (!r.ok) setError(r.error ?? "Falha ao trocar de plano");
                        else {
                          setError(null);
                          router.refresh();
                        }
                      })
                    }
                  >
                    Mudar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {error && <p className="mt-2 field-error">{error}</p>}
        <p className="mt-2 hint">A cobrança mensal automática entra numa fase futura; a troca já vale para taxa e limites.</p>
      </CardBody>
    </Card>
  );
}
