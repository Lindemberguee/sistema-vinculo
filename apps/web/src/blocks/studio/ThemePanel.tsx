"use client";

import { Field, Input, Select, cn } from "@/components/ui";
import type { ButtonRadius } from "@/blocks/render-static";
import { resolveAccent } from "@/blocks/accent";
import type { Theme } from "./Studio";

// Green first, then by family. `*` marks tones that fail 4.5:1 on white — the
// preview shows how we recover (darker tone for text, your colour for fills).
const PRESETS = ["#006B4F", "#0d8061", "#1f6feb", "#155e9c", "#7c3aed", "#db2777", "#c2410c", "#b3261e", "#17201c"];

/** "Tema" tab — the org's visual identity (accent + button shape). Applies live
 * to every block preview and to the published page. */
export function ThemePanel({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const setAccent = (accent: string) => onChange({ ...theme, accent });
  const validHex = /^#[0-9a-fA-F]{6}$/.test(theme.accent);
  const pal = resolveAccent(validHex ? theme.accent : "#006B4F");
  const btnR =
    theme.radius === "full" ? "rounded-full" : theme.radius === "md" ? "rounded-lg" : "rounded-none";

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted">
        Vale para todas as campanhas desta organização. Salva automaticamente.
      </p>

      <Field
        label="Cor da marca"
        hint="Usada em botões, destaques e barras de progresso."
        error={validHex ? undefined : "Use um código hex de 6 dígitos (ex.: #006B4F)"}
      >
        <span className="flex items-center gap-2">
          <input
            type="color"
            value={validHex ? theme.accent : "#006B4F"}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Escolher cor da marca"
            className="size-9 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface"
          />
          <Input value={theme.accent} placeholder="#006B4F" onChange={(e) => setAccent(e.target.value)} />
        </span>
      </Field>

      <div>
        <span className="label">Sugestões</span>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Usar ${c}`}
              onClick={() => setAccent(c)}
              className={cn(
                "size-7 rounded-full border transition-colors",
                theme.accent.toLowerCase() === c.toLowerCase()
                  ? "border-ink ring-2 ring-ink/15"
                  : "border-line-strong hover:border-muted/50",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <Field label="Cantos dos botões">
        <Select
          value={theme.radius}
          onChange={(e) => onChange({ ...theme, radius: e.target.value as ButtonRadius })}
        >
          <option value="full">Arredondado</option>
          <option value="md">Levemente arredondado</option>
          <option value="none">Reto</option>
        </Select>
      </Field>

      <div>
        <span className="label">Prévia</span>
        <div className="mt-1.5 space-y-3 rounded-lg border border-line bg-surface p-4">
          {/* botão preenchido */}
          <span
            className={cn("inline-block px-4 py-2 text-sm font-medium", btnR)}
            style={{ background: pal.accent, color: pal.onAccent }}
          >
            Doar agora
          </span>

          {/* barra de progresso */}
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--color-surface-sunken)" }}>
            <div className="h-full rounded-full" style={{ width: "62%", background: pal.accent }} />
          </div>

          {/* número em destaque (texto sobre branco → usa o tom escurecido) */}
          <div>
            <div className="eyebrow">Arrecadado</div>
            <div className="text-xl font-semibold tabular-nums" style={{ color: pal.textInk }}>
              R$ 12.480
            </div>
          </div>
        </div>

        {pal.lowContrastOnWhite && (
          <p className="mt-2 rounded-md bg-info-bg px-3 py-2 text-xs text-info">
            Esse tom tem pouco contraste no branco. Nos textos e links vamos usar um tom mais escuro
            automaticamente; nos botões, mantemos a sua cor.
          </p>
        )}
      </div>
    </div>
  );
}
