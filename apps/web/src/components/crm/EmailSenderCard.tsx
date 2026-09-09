"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateOrgEmailSender } from "@/server/org/email-config";
import { Card, CardBody, Field, Input, Button } from "@/components/ui";

export function EmailSenderCard({
  orgId,
  fromName,
  replyTo,
  fallbackName,
  fallbackReplyTo,
  domainStatus,
}: {
  orgId: string;
  fromName: string | null;
  replyTo: string | null;
  fallbackName: string;
  fallbackReplyTo: string | null;
  domainStatus: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateOrgEmailSender.bind(null, orgId), null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 text-base font-semibold">Remetente de e-mail</h2>
        <p className="mb-4 text-sm text-muted">
          Como o doador vê o remetente dos e-mails (recibos, avisos e divulgações).{" "}
          {domainStatus === "VERIFIED" ? (
            <>Enviando pelo seu domínio verificado.</>
          ) : (
            <>
              O endereço de envio é da plataforma até você verificar um{" "}
              <Link href={`/orgs/${orgId}/domains`} className="link">
                domínio de e-mail
              </Link>
              .
            </>
          )}
        </p>
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome de exibição" hint={`Em branco usa "${fallbackName}".`}>
            <Input name="fromName" defaultValue={fromName ?? ""} maxLength={78} placeholder={fallbackName} />
          </Field>
          <Field
            label="E-mail de resposta"
            hint={fallbackReplyTo ? `Em branco usa ${fallbackReplyTo}.` : "Para onde vão as respostas dos doadores."}
          >
            <Input name="replyTo" type="email" defaultValue={replyTo ?? ""} placeholder={fallbackReplyTo ?? ""} />
          </Field>
          {state?.error && (
            <p className="field-error sm:col-span-2" role="alert">
              {state.error}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" loading={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
