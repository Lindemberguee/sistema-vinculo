"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WEBHOOK_EVENTS } from "@donation/shared";
import {
  createOutboundWebhook,
  deleteOutboundWebhook,
  setOutboundWebhookActive,
} from "@/server/webhooks/actions";
import { Button, Card, CardBody, Field, Input, Badge } from "@/components/ui";

interface Hook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastDelivery: { status: string; event: string; createdAt: string; responseCode: number | null } | null;
}

export function WebhooksPanel({ orgId, hooks }: { orgId: string; hooks: Hook[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const toggle = (e: string) => setEvents((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  const create = () =>
    start(async () => {
      const r = await createOutboundWebhook(orgId, { url, events: events as never });
      if (!r.ok) {
        setError(r.error ?? "Falha");
        return;
      }
      setError(null);
      setUrl("");
      setEvents([]);
      setSecret(r.secret ?? null);
      router.refresh();
    });

  return (
    <div>
      <Card className="mb-4">
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="grid gap-3"
          >
            <Field label="URL do endpoint (https)">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemplo.com/webhooks/doacoes" />
            </Field>
            <fieldset className="m-0 border-0 p-0">
              <legend className="label mb-1">Eventos</legend>
              <div className="flex flex-wrap gap-3">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand-600"
                      checked={events.includes(e)}
                      onChange={() => toggle(e)}
                    />
                    {e}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <p className="field-error">{error}</p>}
            <div>
              <Button type="submit" size="sm" disabled={pending || !url || events.length === 0}>
                Adicionar webhook
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {secret && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
          <p className="text-sm">
            Guarde o segredo de assinatura (não será mostrado de novo). As entregas vêm com o header{" "}
            <code>X-Webhook-Signature: sha256=HMAC(secret, body)</code>.
          </p>
          <code className="mt-1.5 block break-all text-xs">{secret}</code>
        </div>
      )}

      <ul className="grid gap-2.5">
        {hooks.map((h) => (
          <li key={h.id}>
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="break-all text-sm">{h.url}</strong>
                {h.active ? <Badge tone="success">ativo</Badge> : <Badge tone="neutral">pausado</Badge>}
              </div>
              <div className="mt-1 text-xs text-muted">{h.events.join(", ")}</div>
              {h.lastDelivery && (
                <div className="mt-1 text-xs text-muted">
                  última: {h.lastDelivery.event} → {h.lastDelivery.status}
                  {h.lastDelivery.responseCode ? ` (${h.lastDelivery.responseCode})` : ""} ·{" "}
                  {new Date(h.lastDelivery.createdAt).toLocaleString("pt-BR")}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setOutboundWebhookActive(orgId, h.id, !h.active);
                      router.refresh();
                    })
                  }
                >
                  {h.active ? "Pausar" : "Reativar"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  className="text-danger"
                  onClick={() =>
                    start(async () => {
                      await deleteOutboundWebhook(orgId, h.id);
                      router.refresh();
                    })
                  }
                >
                  Remover
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {hooks.length === 0 && <li className="text-sm text-muted">Nenhum webhook configurado.</li>}
      </ul>
    </div>
  );
}
