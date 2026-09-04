"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDraftOrganizationFormAction,
  registerKycDocument,
  submitOnboardingFormAction,
  type OnboardingResult,
} from "@/server/onboarding/actions";
import { Button, Card, CardBody, Field, Input, Select, cn } from "@/components/ui";

type DocKind = "ESTATUTO" | "ATA" | "CARTAO_CNPJ" | "DOC_RESPONSAVEL" | "COMPROVANTE_BANCARIO";

const DOCS: { kind: DocKind; label: string; required: boolean }[] = [
  { kind: "ESTATUTO", label: "Estatuto social", required: true },
  { kind: "CARTAO_CNPJ", label: "Cartão CNPJ", required: true },
  { kind: "DOC_RESPONSAVEL", label: "Documento do responsável legal", required: true },
  { kind: "COMPROVANTE_BANCARIO", label: "Comprovante bancário", required: true },
  { kind: "ATA", label: "Ata de eleição da diretoria (opcional)", required: false },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orgId, setOrgId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <Steps current={step} />
      <Card>
        <CardBody>
          {step === 1 && (
            <OrgBasicsStep
              onDone={(id) => {
                setOrgId(id);
                setStep(2);
              }}
            />
          )}
          {step === 2 && orgId && <DocsStep orgId={orgId} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && orgId && (
            <SubmitStep orgId={orgId} onBack={() => setStep(2)} onDone={() => router.push(`/orgs/${orgId}`)} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const labels = ["Organização", "Documentos", "Dados bancários"];
  return (
    <ol className="mb-5 flex gap-2">
      {labels.map((l, i) => (
        <li
          key={l}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-center text-xs",
            i + 1 === current ? "bg-brand-600 text-white" : "bg-canvas text-muted",
          )}
        >
          {i + 1}. {l}
        </li>
      ))}
    </ol>
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

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Razão social" error={err("legalName")}>
          <Input name="legalName" required />
        </Field>
        <Field label="Nome de exibição" error={err("displayName")}>
          <Input name="displayName" required />
        </Field>
        <Field label="CNPJ" error={err("cnpj")}>
          <Input name="cnpj" required placeholder="00.000.000/0000-00" />
        </Field>
        <Field label="Endereço (slug)" error={err("slug")} hint="slug.plataforma.com.br">
          <Input name="slug" required />
        </Field>
        <Field label="E-mail de contato" error={err("contactEmail")}>
          <Input name="contactEmail" type="email" required />
        </Field>
        <Field label="Telefone (com DDD)" error={err("contactPhone")}>
          <Input name="contactPhone" required placeholder="11999999999" />
        </Field>
      </div>
      <Field label="Logradouro" error={err("addressStreet")}>
        <Input name="addressStreet" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Número" error={err("addressNumber")}>
          <Input name="addressNumber" required />
        </Field>
        <Field label="Bairro" error={err("addressNeighborhood")}>
          <Input name="addressNeighborhood" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Cidade" error={err("addressCity")}>
          <Input name="addressCity" required />
        </Field>
        <Field label="UF" error={err("addressState")}>
          <Input name="addressState" required maxLength={2} />
        </Field>
        <Field label="CEP" error={err("addressZip")}>
          <Input name="addressZip" required placeholder="00000000" />
        </Field>
      </div>
      {state?.error && <p className="field-error">{state.error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
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

  async function upload(kind: DocKind, file: File) {
    setError(null);
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
    <div className="grid gap-4">
      <p className="hint">PDF, PNG ou JPG, até 10 MB cada.</p>
      {DOCS.map((d) => (
        <div key={d.kind} className="flex items-center justify-between gap-3">
          <span className="text-sm">
            {d.label} {d.required && <span className="text-danger">*</span>}
          </span>
          {uploaded[d.kind] ? (
            <span className="text-sm text-success">✓ {uploaded[d.kind]}</span>
          ) : (
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={busyKind !== null}
              onChange={(e) => e.target.files?.[0] && upload(d.kind, e.target.files[0])}
              className="text-sm"
            />
          )}
        </div>
      ))}
      {busyKind && <p className="hint">Enviando {busyKind}…</p>}
      {error && <p className="field-error">{error}</p>}
      <div className="flex gap-3">
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
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do responsável legal" error={err("legalRepName")}>
          <Input name="legalRepName" required />
        </Field>
        <Field label="CPF do responsável" error={err("legalRepDocument")}>
          <Input name="legalRepDocument" required placeholder="00000000000" />
        </Field>
        <Field label="Código do banco" error={err("bankCode")}>
          <Input name="bankCode" required placeholder="341" />
        </Field>
        <Field label="Agência" error={err("branchNumber")}>
          <Input name="branchNumber" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Conta" error={err("accountNumber")}>
          <Input name="accountNumber" required />
        </Field>
        <Field label="Dígito" error={err("accountCheckDigit")}>
          <Input name="accountCheckDigit" required maxLength={2} />
        </Field>
        <Field label="Tipo" error={err("accountType")}>
          <Select name="accountType">
            <option value="checking">Corrente</option>
            <option value="savings">Poupança</option>
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" value="true" required className="size-4 accent-brand-600" />
        Li e aceito os termos de uso e a política de privacidade.
      </label>
      {state?.error && <p className="field-error">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando cadastro…" : "Enviar para análise"}
        </Button>
      </div>
    </form>
  );
}
