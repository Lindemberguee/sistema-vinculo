"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomDomain, removeCustomDomain, verifyCustomDomain } from "@/server/domains/actions";
import { Button, Card, Badge } from "@/components/ui";

interface Domain {
  id: string;
  host: string;
  verificationToken: string;
  verifiedAt: string | null;
  sslStatus: string;
}

export function CustomDomainsPanel({
  orgId,
  domains,
  cnameTarget,
}: {
  orgId: string;
  domains: Domain[];
  cnameTarget: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [host, setHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; verified?: boolean }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Falha"));
      if (r.ok) {
        setHost("");
        setNote(r.verified ? "Domínio verificado!" : null);
        router.refresh();
      }
    });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addCustomDomain(orgId, host));
        }}
        className="mb-3 flex gap-2"
      >
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="doe.suaong.org.br"
          className="input flex-1"
        />
        <Button type="submit" size="sm" disabled={pending || !host}>
          Adicionar
        </Button>
      </form>
      {error && <p className="field-error">{error}</p>}
      {note && <p className="text-sm text-success">{note}</p>}

      <ul className="grid gap-2.5">
        {domains.map((d) => (
          <li key={d.id}>
            <Card className="p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{d.host}</strong>
                {d.verifiedAt ? (
                  <Badge tone="success">verificado · SSL {d.sslStatus.toLowerCase()}</Badge>
                ) : (
                  <Badge tone="warn">aguardando DNS</Badge>
                )}
              </div>
              {!d.verifiedAt && (
                <p className="mt-2 text-sm text-muted">
                  Crie um <code>CNAME</code> de <code>{d.host}</code> para <code>{cnameTarget}</code>
                  <br />
                  <span className="text-xs">
                    ou um <code>TXT</code> em <code>_donation-verify.{d.host}</code> com o valor{" "}
                    <code>{d.verificationToken}</code>
                  </span>
                </p>
              )}
              <div className="mt-2 flex gap-2">
                {!d.verifiedAt && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => verifyCustomDomain(orgId, d.id))}
                  >
                    Verificar agora
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => removeCustomDomain(orgId, d.id))}
                  className="text-danger"
                >
                  Remover
                </Button>
              </div>
            </Card>
          </li>
        ))}
        {domains.length === 0 && <li className="text-sm text-muted">Nenhum domínio próprio ainda.</li>}
      </ul>
    </div>
  );
}
