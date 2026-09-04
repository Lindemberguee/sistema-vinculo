"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { testWebhookEndpoint, updateWebhookCredentials, type WebhookTestResult } from "@/server/payments/actions";
import { Field, Input, Button } from "@/components/ui";

export function WebhookSettings({
  orgId,
  providerLabel,
  url,
  user,
  password,
  hostNote,
}: {
  orgId: string;
  providerLabel: string;
  url: string;
  user: string;
  password: string;
  hostNote: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [state, action, pending] = useActionState<{ ok: boolean; error?: string } | null, FormData>(
    updateWebhookCredentials.bind(null, orgId),
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="card p-5">
      <div className="text-sm font-semibold">Webhook — configure no painel do {providerLabel}</div>
      <p className="mt-1 text-xs text-muted">
        Crie um webhook apontando para a URL abaixo, com autenticação Basic (usuário e senha).
      </p>

      <div className="mt-3 space-y-2 text-sm">
        <CopyRow label="URL" value={url} />
        <CopyRow label="Usuário" value={user} />
        <CopyRow
          label="Senha"
          value={password}
          masked={!reveal}
          rightSlot={
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
              className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
      </div>

      {hostNote && (
        <p className="mt-2 text-xs text-warn">
          Você está acessando o painel por <code>{safeHost(url)}</code>. Se o endereço público (ou túnel de teste) for
          outro, troque o host da URL.
        </p>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <TestWebhook orgId={orgId} defaultUrl={url} />
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {editing ? (
          <form action={action} className="space-y-3">
            <Field label="Usuário" hint="Letras, números, ponto, hífen e underline. 3–40 caracteres.">
              <Input name="user" defaultValue={user} autoComplete="off" maxLength={40} required />
            </Field>
            <Field label="Senha" hint="Deixe em branco para manter a atual. Mín. 8, sem espaços nem “:”.">
              <PasswordInput />
            </Field>
            {state?.error && <p className="field-error">{state.error}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted hover:text-ink">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Editar usuário / senha
          </Button>
        )}
      </div>
    </div>
  );
}

function TestWebhook({ orgId, defaultUrl }: { orgId: string; defaultUrl: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<WebhookTestResult | null>(null);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted">Testar webhook</div>
      <p className="text-xs text-muted">
        Envia um <code>ping</code> assinado para a URL (acessível? usuário/senha conferem?) e consulta a Pagar.me sobre
        as entregas reais para este endereço.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 font-mono text-xs"
          aria-label="URL do webhook para testar"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || !url.trim()}
          onClick={() =>
            start(async () => {
              setResult(null);
              setResult(await testWebhookEndpoint(orgId, url.trim()));
            })
          }
        >
          {pending ? "Testando…" : "Testar"}
        </Button>
      </div>
      {result && (
        <div className="space-y-1">
          <p className={`text-xs ${result.ok ? "text-success" : "field-error"}`}>
            {result.ok ? "Ping OK — URL acessível e autenticação válida." : result.error ?? "Falhou."}
            {result.note ? ` ${result.note}` : ""}
          </p>
          {result.provider && (
            <p className={`text-xs ${result.provider.degraded ? "text-warn" : result.provider.registered ? "text-success" : "text-muted"}`}>
              {result.provider.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PasswordInput() {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input
        name="password"
        type={show ? "text" : "password"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        autoComplete="new-password"
        placeholder="(manter atual)"
        className="flex-1"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar" : "Mostrar"}
        className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-muted hover:bg-canvas hover:text-ink"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => {
          const rnd = Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[b % 55])
            .join("");
          setVal(rnd);
          setShow(true);
        }}
        className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
      >
        Gerar
      </button>
    </div>
  );
}

function CopyRow({
  label,
  value,
  masked,
  rightSlot,
}: {
  label: string;
  value: string;
  masked?: boolean;
  rightSlot?: ReactNode;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-muted">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs">
        {masked ? "•".repeat(Math.min(Math.max(value.length, 8), 24)) : value}
      </code>
      {rightSlot}
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

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
