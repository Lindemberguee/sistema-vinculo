"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { acceptInvitation } from "@/server/team/actions";
import { Button } from "@/components/ui";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { update } = useSession();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        disabled={pending}
        className="w-full"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await acceptInvitation(token);
            if (!res.ok || !res.organizationId) {
              setError(res.error ?? "Não foi possível aceitar o convite.");
              return;
            }
            await update(); // refresh memberships in the session
            router.push(`/orgs/${res.organizationId}`);
            router.refresh();
          })
        }
      >
        {pending ? "Entrando…" : "Aceitar convite"}
      </Button>
      {error && <p className="field-error mt-2">{error}</p>}
    </>
  );
}
