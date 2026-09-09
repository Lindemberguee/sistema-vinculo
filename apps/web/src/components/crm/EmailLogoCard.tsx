"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateEmailLogo } from "@/server/crm/email-templates";
import { Card, CardBody, Input, Button } from "@/components/ui";

export function EmailLogoCard({ orgId, logoUrl }: { orgId: string; logoUrl: string | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateEmailLogo.bind(null, orgId), null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-4">
        <div className="grid h-12 w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-canvas">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="text-3xs text-faint">sem logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Marca nos e-mails</div>
          <p className="text-xs text-muted">Aparece no topo de todos os e-mails que usam o modelo padrão.</p>
        </div>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <Input
            name="logoUrl"
            type="url"
            defaultValue={logoUrl ?? ""}
            placeholder="https://…/logo.png"
            className="w-64"
          />
          <Button type="submit" size="sm" variant="secondary" loading={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {state?.error && (
            <span className="field-error w-full" role="alert">
              {state.error}
            </span>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
