"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectGateway, disconnectGateway, type PaymentConnectResult } from "@/server/payments/actions";
import { Field, Input, Select, Button } from "@/components/ui";

const PROVIDERS: { value: string; label: string; ready: boolean }[] = [
  { value: "PAGARME", label: "Pagar.me", ready: true },
  { value: "MERCADOPAGO", label: "Mercado Pago (em breve)", ready: false },
  { value: "ASAAS", label: "Asaas (em breve)", ready: false },
  { value: "STRIPE", label: "Stripe (em breve)", ready: false },
];

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
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  if (state?.ok && state.webhook) {
    return (
      <div className="card border-success/30 bg-success-bg p-5">
        <div className="text-sm font-semibold text-success">Conectado! Falta 1 passo</div>
        <p className="mt-1 text-sm">
          No painel do seu provedor, crie um webhook com estes dados (autenticação Basic):
        </p>
        <div className="mt-3 space-y-2">
          <Copy label="URL" value={state.webhook.url} />
          <Copy label="Usuário" value={state.webhook.user} />
          <Copy label="Senha" value={state.webhook.password} />
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
        <h2 className="text-sm font-semibold">{reconnect ? "Reconectar / trocar chaves" : "Conectar um provedor"}</h2>
        <p className="mt-0.5 text-xs text-muted">
          Pegue as chaves no painel do provedor (ex.: Pagar.me → Configurações → Chaves de API). A chave secreta é
          guardada cifrada e nunca é exibida de volta.
        </p>
      </div>

      <Field label="Provedor">
        <Select name="provider" defaultValue={currentProvider ?? "PAGARME"}>
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value} disabled={!p.ready}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Chave secreta" error={err("secretKey")} hint="Começa com sk_ (ou sk_test_ no sandbox).">
        <Input name="secretKey" type="password" required autoComplete="off" placeholder="sk_..." />
      </Field>
      <Field label="Chave pública" error={err("publicKey")} hint="Começa com pk_. Usada para tokenizar o cartão no navegador.">
        <Input name="publicKey" required autoComplete="off" placeholder="pk_..." />
      </Field>

      {state?.error && <p className="field-error">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Validando…" : reconnect ? "Salvar chaves" : "Conectar"}
        </Button>
        {reconnect && (
          <button
            type="button"
            disabled={disc}
            onClick={() => {
              if (confirm("Desconectar o provedor? A campanha para de receber doações até você reconectar.")) {
                startDisc(async () => {
                  await disconnectGateway(orgId);
                  router.refresh();
                });
              }
            }}
            className="text-sm font-medium text-danger hover:underline"
          >
            Desconectar
          </button>
        )}
      </div>
    </form>
  );
}

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-2.5 py-1.5 text-xs">{value}</code>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {
            /* ignore */
          }
        }}
      >
        {done ? "✓" : "Copiar"}
      </Button>
    </div>
  );
}
