"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronRight, Circle, Copy, Loader2, XCircle } from "lucide-react";
import {
  addSendingDomain,
  deleteSendingDomain,
  refreshSendingDomain,
  verifySendingDomain,
} from "@/server/org/sending-domain";
import { Card, CardBody, Field, Input, Button, useConfirm, cn } from "@/components/ui";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: string;
  priority?: number;
}

/** `send.mail` (relative) + `send.mail.suaong.org.br` (FQDN) — panels differ on which they want. */
function fqdn(name: string, sendingDomain: string): string {
  const root = sendingDomain.split(".").slice(1).join(".");
  if (!root || name === sendingDomain || name.endsWith(`.${root}`)) return name;
  return `${name}.${root}`;
}

export function SendingDomainCard({
  orgId,
  domain,
  status,
  records,
}: {
  orgId: string;
  domain: string | null;
  status: string;
  records: DnsRecord[];
}) {
  const router = useRouter();
  const [addState, addAction, adding] = useActionState(addSendingDomain.bind(null, orgId), null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (addState?.ok) router.refresh();
  }, [addState, router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Falha");
      else router.refresh();
    });

  const verified = status === "VERIFIED";
  const failed = status === "FAILED";

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Domínio de e-mail próprio</h2>
            <span className="text-2xs text-faint">Provedor: Resend · São Paulo</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Sem isso, os e-mails da sua organização saem do domínio da plataforma <strong>com o nome dela</strong> no
            remetente — já funciona, não precisa fazer nada. Com um subdomínio próprio verificado, eles passam a sair
            de <code>no-reply@seu-subdominio</code>: melhor entrega e a sua marca no endereço.
          </p>
          <p className="mt-1 text-xs text-muted">
            A verificação é feita pela Resend (nosso provedor). Você só publica 3 registros no DNS do seu domínio —{" "}
            <strong>não precisa criar conta em lugar nenhum</strong>.
          </p>
        </div>

        {domain && <Timeline status={status} />}

        {!domain ? (
          <div className="space-y-3">
            <Steps current={1} />
            <form action={addAction} className="flex flex-wrap items-end gap-3">
              <Field label="1. Seu subdomínio de envio" hint="Ex.: mail.suaong.org.br — use um subdomínio, não o domínio raiz.">
                <Input name="domain" placeholder="mail.suaong.org.br" className="w-64" required />
              </Field>
              <Button type="submit" size="sm" loading={adding}>
                {adding ? "Adicionando…" : "Adicionar domínio"}
              </Button>
              {addState?.error && (
                <p className="field-error w-full" role="alert">
                  {addState.error}
                </p>
              )}
            </form>
          </div>
        ) : verified ? (
          <div className="flex items-center gap-2 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Verificado — os e-mails saem de <code>no-reply@{domain}</code>.
          </div>
        ) : (
          <div className="space-y-3">
            <Steps current={records.length > 0 ? 2 : 1} />

            <p className="text-sm">
              <strong>2.</strong> Publique estes 3 registros no DNS de <strong>{domain}</strong> e depois{" "}
              <strong>3.</strong> clique em “Verificar”. A propagação leva de alguns minutos a algumas horas.
            </p>

            {failed && (
              <div className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger">
                <XCircle className="mt-0.5 size-3.5 shrink-0" />
                A última verificação falhou. Confira se os registros estão exatamente como abaixo (sem aspas
                extras, sem espaços) e tente de novo em alguns minutos.
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-faint">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Nome / Host</th>
                    <th className="px-3 py-2 font-semibold">Valor / Conteúdo</th>
                    <th className="px-3 py-2 font-semibold">Prio.</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="px-3 py-2 font-mono">{r.type}</td>
                      <td className="px-3 py-2">
                        <Copyable text={r.name} />
                        <div className="mt-0.5 text-3xs text-faint">
                          ou <Copyable text={fqdn(r.name, domain)} muted />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Copyable text={r.value} />
                      </td>
                      <td className="px-3 py-2 font-mono">{r.priority ?? "—"}</td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-muted">
                        Buscando os registros no Resend… clique em “Atualizar status”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <details className="group text-sm">
              <summary className="w-fit cursor-pointer list-none font-medium text-brand-600">
                <ChevronRight className="mr-1 inline size-3.5 transition-transform group-open:rotate-90" />
                Não sei mexer no DNS
              </summary>
              <div className="mt-2 space-y-1.5 text-xs text-muted">
                <p>
                  Os registros ficam no painel de quem gerencia o seu domínio — normalmente o registrador
                  (Registro.br, GoDaddy, Hostgator, Locaweb) ou a Cloudflare. Procure por{" "}
                  <strong>“DNS”</strong>, <strong>“Zona DNS”</strong> ou <strong>“Editor de DNS”</strong> e adicione
                  cada linha da tabela acima.
                </p>
                <ul className="ml-4 list-disc space-y-0.5">
                  <li>No campo <strong>Nome/Host</strong>, tente primeiro a forma curta; se der erro, use a forma completa (o “ou …” abaixo de cada nome).</li>
                  <li>Na Cloudflare, deixe cada registro como <strong>“DNS only” (nuvem cinza)</strong>.</li>
                  <li>Cole o <strong>Valor</strong> exatamente — sem aspas nem espaços a mais.</li>
                </ul>
                <p>
                  Não tem quem faça isso? Sem problema — <strong>deixe assim</strong>: seus e-mails continuam saindo
                  com o nome da sua organização pelo domínio da plataforma.
                </p>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                loading={pending}
                onClick={() => run(() => verifySendingDomain(orgId))}
              >
                {pending ? "Verificando…" : "Já publiquei — verificar"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => refreshSendingDomain(orgId))}
              >
                Atualizar status
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Remover o domínio de envio?",
                    description: "Os e-mails voltam a sair pelo domínio da plataforma.",
                    confirmLabel: "Remover",
                    tone: "danger",
                  });
                  if (ok) run(() => deleteSendingDomain(orgId));
                }}
              >
                Remover
              </Button>
              {msg && (
                <span className="field-error" role="alert">
                  {msg}
                </span>
              )}
            </div>
          </div>
        )}
      </CardBody>
      {dialog}
    </Card>
  );
}

function Timeline({ status }: { status: string }) {
  const steps: { key: string; label: string; done: boolean; active: boolean; failed?: boolean }[] = [
    { key: "added", label: "Domínio adicionado", done: true, active: false },
    {
      key: "dns",
      label: status === "FAILED" ? "DNS não encontrado" : "Registros no DNS",
      done: status === "VERIFIED",
      active: status === "PENDING",
      failed: status === "FAILED",
    },
    { key: "verified", label: "Verificado", done: status === "VERIFIED", active: false },
  ];
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium",
              s.done
                ? "bg-success-bg text-success"
                : s.failed
                  ? "bg-danger-bg text-danger"
                  : s.active
                    ? "bg-warn-bg text-warn"
                    : "bg-canvas text-faint",
            )}
          >
            {s.done ? (
              <Check className="size-3" />
            ) : s.failed ? (
              <XCircle className="size-3" />
            ) : s.active ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Circle className="size-3" />
            )}
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-line" />}
        </div>
      ))}
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const items = ["Adicionar o subdomínio", "Publicar os 3 registros no DNS", "Clicar em “Verificar”"];
  return (
    <ol className="grid gap-1 text-xs">
      {items.map((label, i) => {
        const n = i + 1;
        return (
          <li key={n} className={cn("flex items-center gap-2", n === current ? "text-ink" : "text-faint")}>
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full text-3xs font-semibold",
                n < current
                  ? "bg-success text-white"
                  : n === current
                    ? "bg-brand-600 text-white"
                    : "bg-canvas text-faint",
              )}
            >
              {n < current ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function Copyable({ text, muted }: { text: string; muted?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="group inline-flex max-w-full items-start gap-1.5 text-left align-top"
      title="Copiar"
    >
      <code className={cn("break-all font-mono", muted ? "text-3xs text-faint" : "text-2xs")}>{text}</code>
      {done ? (
        <span className="text-3xs text-success">✓</span>
      ) : (
        <Copy className="mt-0.5 size-3 shrink-0 text-faint group-hover:text-ink" />
      )}
    </button>
  );
}
