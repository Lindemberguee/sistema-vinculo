"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { adminCreateOrganization, type AdminOrgCreateResult } from "@/server/admin/orgs";
import { Button, Modal, Field, Input, Select, cn } from "@/components/ui";

const DIACRITICS = /[̀-ͯ]/g;
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function NewOrgButton({ plans }: { plans: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminOrgCreateResult | null, FormData>(
    adminCreateOrganization,
    null,
  );

  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [billing, setBilling] = useState<"trial" | "active">("trial");
  const effectiveSlug = slugTouched && slug ? slug : slugify(displayName);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state?.ok, router]);

  const previewHost = useMemo(() => {
    if (typeof window === "undefined") return "instituto.plataforma.com.br";
    const base = window.location.host.replace(/^admin\./, "").replace(/^app\./, "");
    return `${effectiveSlug || "instituto"}.${base}`;
  }, [effectiveSlug]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4 shrink-0" aria-hidden />
        Nova organização
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova organização"
        description="Cria a instituição já ativa e envia o convite de proprietário por e-mail."
        size="lg"
      >
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome público" required error={err("displayName")}>
              <Input
                name="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Instituto Exemplo"
                autoFocus
                required
              />
            </Field>
            <Field label="Razão social" required error={err("legalName")}>
              <Input name="legalName" placeholder="Instituto Exemplo de Apoio Social" required />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CNPJ" required error={err("cnpj")}>
              <Input name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required />
            </Field>
            <div>
              <Field label="Endereço da página" required error={err("slug")}>
                <Input
                  name="slug"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  inputMode="url"
                  required
                />
              </Field>
              <p className="mt-1 truncate text-xs text-muted">{previewHost}</p>
            </div>
          </div>

          <Field label="Plano" required error={err("planId")}>
            <Select name="planId" defaultValue={plans[0]?.id ?? ""} required>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset className="border-0 p-0">
            <legend className="label mb-2">Cobrança</legend>
            <input type="hidden" name="billing" value={billing} />
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["trial", "Teste grátis", "30 dias, depois combina a mensalidade"],
                  ["active", "Já marcar como paga", "Assinatura ativa por 30 dias a partir de hoje"],
                ] as const
              ).map(([value, label, hint]) => {
                const active = billing === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setBilling(value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
                      active ? "border-brand-600 bg-brand-50" : "border-line-strong hover:bg-canvas",
                    )}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field
            label="E-mail do responsável"
            required
            error={err("ownerEmail")}
            hint="Recebe um convite de proprietário. Ao aceitar (criando conta, se ainda não tiver), entra na organização."
          >
            <Input name="ownerEmail" type="email" placeholder="maria@instituto.org" required />
          </Field>

          {state?.error && (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          )}

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <Button type="submit" loading={pending} disabled={displayName.trim().length < 2}>
              {pending ? "Criando…" : "Criar organização"}
            </Button>
            <span className="text-xs text-muted">O responsável configura o gateway e as campanhas depois.</span>
          </div>
        </form>
      </Modal>
    </>
  );
}
