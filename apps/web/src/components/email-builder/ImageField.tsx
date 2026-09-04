"use client";

import { useRef, useState } from "react";
import { Field, Input } from "@/components/ui";

/**
 * Image source: paste a URL, or upload a file (when object storage is
 * configured). Upload PUTs straight to storage via a presigned URL and stores
 * the public proxy path.
 */
export function ImageField({
  orgId,
  value,
  onChange,
}: {
  orgId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/panel/email-assets/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, contentType: file.type, sizeBytes: file.size }),
      });
      if (res.status === 503) {
        setErr("Upload indisponível — cole a URL de uma imagem hospedada.");
        return;
      }
      if (!res.ok) {
        setErr(res.status === 413 ? "Imagem muito grande (máx. 2 MB)." : "Não foi possível enviar a imagem.");
        return;
      }
      const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string };
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) {
        setErr("Falha ao enviar a imagem.");
        return;
      }
      onChange(publicUrl);
    } catch {
      setErr("Falha ao enviar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label="Imagem" hint="Cole um link ou envie um arquivo (PNG, JPG, GIF ou WebP, até 2 MB).">
      <Input
        type="url"
        placeholder="https://…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="btn-secondary btn-sm"
        >
          {busy ? "Enviando…" : "Enviar imagem"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-muted hover:text-danger">
            Remover
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      {err && <p className="field-error mt-1">{err}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 max-h-32 rounded-md border border-line object-contain" />
      )}
    </Field>
  );
}
