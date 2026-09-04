"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelRecurringByToken } from "@/server/recurring/actions";
import { Button } from "@/components/ui";

export function RecurringManage({ token, canceled }: { token: string; canceled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(canceled);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (done)
    return <p className="mt-4 text-sm text-success">Sua doação recorrente foi cancelada. Obrigado pelo apoio! 💚</p>;

  return (
    <div className="mt-4">
      {!confirming ? (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Cancelar doação recorrente
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Tem certeza?</span>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await cancelRecurringByToken(token);
                if (r.ok) {
                  setDone(true);
                  router.refresh();
                } else setError(r.error ?? "Falha ao cancelar");
              })
            }
          >
            {pending ? "Cancelando…" : "Sim, cancelar"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Voltar
          </Button>
        </div>
      )}
      {error && <p className="field-error mt-2">{error}</p>}
    </div>
  );
}
