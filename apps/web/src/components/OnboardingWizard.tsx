"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Upload } from "lucide-react";
import {
  createDraftOrganizationFormAction,
  registerKycDocument,
  submitOnboardingFormAction,
  type OnboardingResult,
} from "@/server/onboarding/actions";
import { lookupCep } from "@/blocks/pagarme-browser";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FormSection,
  Input,
  Select,
  Stepper,
} from "@/components/ui";

type DocKind = "ESTATUTO" | "ATA" | "CARTAO_CNPJ" | "DOC_RESPONSAVEL" | "COMPROVANTE_BANCARIO";

const DOCS: { kind: DocKind; label: string; required: boolean }[] = [
  { kind: "ESTATUTO", label: "Estatuto social", required: true },
  { kind: "CARTAO_CNPJ", label: "Cartão CNPJ", required: true },
  { kind: "DOC_RESPONSAVEL", label: "Documento do responsável legal", required: true },
  { kind: "COMPROVANTE_BANCARIO", label: "Comprovante bancário", required: true },
  { kind: "ATA", label: "Ata de eleição da diretoria", required: false },
];

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg";
const STEPS = ["Organização", "Documentos", "Dados bancários"];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Stepper steps={STEPS} current={step} />
      </div>
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold">{STEPS[step - 1]}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {step === 1 && "Dados da organização e endereço."}
            {step === 2 && "Envie os documentos para a análise (KYC)."}
            {step === 3 && "Conta para receber os repasses e aceite dos termos."}
          </p>
          <div className="mt-4">
            {step === 1 && (
              <OrgBasicsStep
                onDone={(id) => {
                  setOrgId(id);
                  setStep(2);
                }}
              />
            )}
            {step === 2 && orgId && (
              <DocsStep orgId={orgId} onBack={() => setStep(1)} onNext={() => setStep(3)} />
            )}
            {step === 3 && orgId && (
              <SubmitStep
                orgId={orgId}
                onBack={() => setStep(2)}
                onDone={() => router.push(`/orgs/${orgId}`)}
              />
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function OrgBasicsStep({ onDone }: { onDone: (orgId: string) => void }) {
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(
    createDraftOrganizationFormAction,
    null,
  );
  useEffect(() => {
    if (state?.ok && state.organizationId) onDone(state.organizationId);
  }, [state, onDone]);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const [slug, setSlug] = useState("");
  const [addr, setAddr] = useState({ zip: "", street: "", neighborhood: "", city: "", state: "" });
  const [cepLoading, setCepLoading] = useState(false);

  async function onCep(raw: string) {
    if (raw.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    try {
      const found = await lookupCep(raw);
      if (found) {
        setAddr((a) => ({
          ...a,
          street: found.street || a.street,
          neighborhood: found.neighborhood || a.neighborhood,
          city: found.city || a.city,
          state: found.state || a.state,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }

  return (
    <form action={formAction} className="grid gap-6">
      <FormSection title="Identificação">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razão social" required error={err("legalName")}>
            <Input name="legalName" required />
          </Field>
          <Field label="Nome de exibição" required error={err("displayName")}>
            <Input name="displayName" required />
          </Field>
          <Field label="CNPJ" required error={err("cnpj")}>
            <Input name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" />
          </Field>
          <Field
            label="Endereço público (slug)"
            required
            error={err("slug")}
            hint={slug ? `${slug.toLowerCase()}.plataforma.com.br` : "ex.: instituto-agua-viva"}
          >
            <Input
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contato">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="E-mail de contato" required error={err("contactEmail")}>
            <Input name="contactEmail" type="email" required autoComplete="email" />
          </Field>
          <Field label="Telefone (com DDD)" required error={err("contactPhone")}>
            <Input name="contactPhone" required inputMode="tel" placeholder="(11) 99999-9999" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Endereço" description="Informe o CEP para preencher o resto automaticamente.">
        <div className="grid gap-3">
          <div className="grid grid-cols-[9rem_1fr] gap-3">
            <Field label="CEP" required error={err("addressZip")} hint={cepLoading ? "Buscando…" : undefined}>
              <Input
                name="addressZip"
                required
                inputMode="numeric"
                placeholder="00000-000"
                maxLength={9}
                value={addr.zip}
                onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))}
                onBlur={(e) => onCep(e.target.value)}
              />
            </Field>
            <Field label="Número" required error={err("addressNumber")}>
              <Input name="addressNumber" required inputMode="numeric" />
            </Field>
          </div>
          <Field label="Logradouro" required error={err("addressStreet")}>
            <Input
              name="addressStreet"
              required
              value={addr.street}
              onChange={(e) => setAddr((a) => ({ ...a, street: e.target.value }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bairro" required error={err("addressNeighborhood")}>
              <Input
                name="addressNeighborhood"
                required
                value={addr.neighborhood}
                onChange={(e) => setAddr((a) => ({ ...a, neighborhood: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label="Cidade" required error={err("addressCity")}>
                <Input
                  name="addressCity"
                  required
                  value={addr.city}
                  onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))}
                />
              </Field>
              <Field label="UF" required error={err("addressState")}>
                <Input
                  name="addressState"
                  required
                  maxLength={2}
                  className="uppercase"
                  value={addr.state}
                  onChange={(e) =>
                    setAddr((a) => ({
                      ...a,
                      state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
                    }))
                  }
                />
              </Field>
            </div>
          </div>
        </div>
      </FormSection>

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Salvando…" : "Continuar"}
        </Button>
      </div>
    </form>
  );
}

function DocsStep({ orgId, onBack, onNext }: { orgId: string; onBack: () => void; onNext: () => void }) {
  const [uploaded, setUploaded] = useState<Partial<Record<DocKind, string>>>({});
  const [busyKind, setBusyKind] = useState<DocKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const inputs = useRef<Partial<Record<DocKind, HTMLInputElement | null>>>({});

  async function upload(kind: DocKind, file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" tem mais de 10 MB.`);
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Envie um arquivo PDF, PNG ou JPG.");
      return;
    }
    setBusyKind(kind);
    try {
      const res = await fetch("/api/panel/kyc/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, kind, contentType: file.type, sizeBytes: file.size }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao preparar upload");
      const { uploadUrl, storageKey } = (await res.json()) as { uploadUrl: string; storageKey: string };

      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Falha ao enviar o arquivo");

      await new Promise<void>((resolve, reject) =>
        start(async () => {
          const reg = await registerKycDocument(orgId, {
            kind,
            storageKey,
            contentType: file.type,
            sizeBytes: file.size,
          });
          if (reg.ok) {
            setUploaded((u) => ({ ...u, [kind]: file.name }));
            resolve();
          } else reject(new Error(reg.error ?? "Falha ao registrar o documento"));
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setBusyKind(null);
    }
  }

  const missingRequired = DOCS.filter((d) => d.required && !uploaded[d.kind]);

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted">PDF, PNG ou JPG, até 10 MB cada.</p>
      <ul className="grid gap-2">
        {DOCS.map((d) => {
          const busy = busyKind === d.kind;
          const done = uploaded[d.kind];
          return (
            <li
              key={d.kind}
              className="flex items-center justify-between gap-3 rounded-xl border border-line-strong p-3"
            >
              <span className="min-w-0 text-sm">
                {d.label}
                {d.required ? (
                  <span className="text-danger"> *</span>
                ) : (
                  <span className="text-faint"> (opcional)</span>
                )}
                {done && <span className="mt-0.5 block truncate text-xs text-muted">{done}</span>}
              </span>
              <div className="shrink-0">
                <input
                  ref={(el) => {
                    inputs.current[d.kind] = el;
                  }}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(e) => e.target.files?.[0] && upload(d.kind, e.target.files[0])}
                />
                {busy ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Enviando…
                  </span>
                ) : done ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="size-4 text-success" aria-hidden />
                    <button
                      type="button"
                      onClick={() => inputs.current[d.kind]?.click()}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      Trocar
                    </button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busyKind !== null}
                    onClick={() => inputs.current[d.kind]?.click()}
                  >
                    <Upload className="size-3.5" aria-hidden /> Enviar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onNext} disabled={missingRequired.length > 0}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function SubmitStep({ orgId, onBack, onDone }: { orgId: string; onBack: () => void; onDone: () => void }) {
  const action = submitOnboardingFormAction.bind(null, orgId);
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(action, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  return (
    <form action={formAction} className="grid gap-6">
      <FormSection title="Responsável legal">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do responsável legal" required error={err("legalRepName")}>
            <Input name="legalRepName" required autoComplete="name" />
          </Field>
          <Field label="CPF do responsável" required error={err("legalRepDocument")}>
            <Input name="legalRepDocument" required inputMode="numeric" placeholder="000.000.000-00" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Conta bancária" description="A conta precisa ser da própria organização (mesmo CNPJ).">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código do banco" required error={err("bankCode")} hint="3 dígitos — ex.: 341 (Itaú), 001 (BB)">
            <Input name="bankCode" required inputMode="numeric" maxLength={3} placeholder="341" />
          </Field>
          <Field label="Agência" required error={err("branchNumber")}>
            <Input name="branchNumber" required inputMode="numeric" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem]">
          <Field label="Conta" required error={err("accountNumber")}>
            <Input name="accountNumber" required inputMode="numeric" />
          </Field>
          <Field label="Dígito" required error={err("accountCheckDigit")}>
            <Input name="accountCheckDigit" required maxLength={2} />
          </Field>
          <Field label="Tipo" error={err("accountType")}>
            <Select name="accountType">
              <option value="checking">Corrente</option>
              <option value="savings">Poupança</option>
            </Select>
          </Field>
        </div>
      </FormSection>

      <Checkbox
        name="acceptTerms"
        value="true"
        required
        label="Li e aceito os termos de uso e a política de privacidade."
      />

      {state?.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Enviando cadastro…" : "Enviar para análise"}
        </Button>
      </div>
    </form>
  );
}
