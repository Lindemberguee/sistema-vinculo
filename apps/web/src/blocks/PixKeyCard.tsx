"use client";

import { CopyButton } from "@/components/public/CopyButton";

const TYPE_LABEL: Record<string, string> = {
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

export function PixKeyCard({
  title,
  keyType,
  keyValue,
  note,
  accent,
}: {
  title: string;
  keyType: string;
  keyValue: string;
  note?: string;
  accent: string;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-muted">Chave Pix ({TYPE_LABEL[keyType] ?? "chave"})</div>
        {keyValue ? (
          <>
            <div
              className="mt-3 break-all rounded-lg px-3 py-2.5 font-mono text-sm"
              style={{ background: `${accent}12`, color: "var(--color-ink)" }}
            >
              {keyValue}
            </div>
            <div className="mt-3 flex justify-center">
              <CopyButton text={keyValue} label="Copiar chave Pix" />
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-line-strong px-3 py-4 text-sm text-faint">
            Informe a chave Pix nas configurações do bloco
          </div>
        )}
        {note && <p className="mt-3 text-xs text-muted">{note}</p>}
      </div>
    </div>
  );
}
