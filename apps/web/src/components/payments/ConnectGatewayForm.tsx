"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectGateway, disconnectGateway, type PaymentConnectResult } from "@/server/payments/actions";
import { Field, Input, Select, Button, CopyField, useConfirm } from "@/components/ui";

const READY_PROVIDERS = [{ value: "PAGARME", label: "Pagar.me" }];
const SOON = "Mercado Pago, Asaas e Stripe";

export function ConnectGatewayForm({
  orgId,
  currentProvider,
  reconnect,
}: {
  orgId: string;
  currentProvider: string | null;
  reconnect: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PaymentConnectResult | null, FormData>(
    connectGateway.bind(null, orgId),
    null,
  );
  const [disc, startDisc] = useTransition();
  const { confirm, dialog } = useConfirm();
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  if (state?.ok && state.webhook) {
    return (
      <div className="card border-success/30 bg-success-bg p-5">
        <div className="text-sm font-semibold text-success">Conectado! Falta 1 passo</div>
        <p className="mt-1 text-sm">
          No painel do seu provedor, crie um webhook com estes dados (autenticação Basic):
        </p>
        <div className="mt-3 space-y-2">
          <CopyField label="URL" value={state.webhook.url} />
          <CopyField label="Usuário" value={state.webhook.user} />
          <CopyField label="Senha" value={state.webhook.password} />
        </div>
        <Button className="mt-4" size="sm" onClick={() => router.refresh()}>
          Concluí
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">
          {reconnect ? "Reconectar / trocar chaves" : "Conectar um provedor"}
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Pegue as chaves no painel do provedor (ex.: Pagar.me → Configurações → Chaves de API). A
          chave secreta é guardada cifrada e nunca é exibida de volta.
        </p>
      </div>

      <Field label="Provedor" hint={`${SOON} em breve.`}>
        <Select name="provider" defaultValue={currentProvider ?? "PAGARME"}>
          {READY_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Chave secreta"
        required
        error={err("secretKey")}
        hint="Começa com sk_ (ou sk_test_ no sandbox)."
      >
        <Input name="secretKey" type="password" required autoComplete="off" placeholder="sk_..." />
      </Field>
      <Field
        label="Chave pública"
        required
        error={err("publicKey")}
        hint="Começa com pk_. Usada para tokenizar o cartão no navegador."
      >
        <Input name="publicKey" required autoComplete="off" placeholder="pk_..." />
      </Field>

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? "Validando…" : reconnect ? "Salvar chaves" : "Conectar"}
        </Button>
        {reconnect && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disc}
            onClick={async () => {
              const ok = await confirm({
                title: "Desconectar o provedor?",
                description: "A campanha para de receber doações até você reconectar.",
                confirmLabel: "Desconectar",
                tone: "danger",
              });
              if (ok) {
                startDisc(async () => {
                  await disconnectGateway(orgId);
                  router.refresh();
                });
              }
            }}
          >
            Desconectar
          </Button>
        )}
      </div>
      {dialog}
    </form>
  );
}
