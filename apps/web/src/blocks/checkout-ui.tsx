"use client";

import type { ReactNode } from "react";
import { CopyButton } from "@/components/public/CopyButton";

export const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

/** Shared surface for every public checkout widget. */
export const checkoutBox =
  "w-full max-w-[460px] rounded-xl border border-line bg-surface p-5 shadow-card";

export function Labeled({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[0.8125rem] font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">(opcional)</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export interface CardState {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

/** Labeled credit-card inputs. Tokenized in the browser — never posted to our API. */
export function CardFields({
  card,
  onChange,
}: {
  card: CardState;
  onChange: (next: CardState) => void;
}) {
  const set = (patch: Partial<CardState>) => onChange({ ...card, ...patch });
  return (
    <div className="grid gap-2.5">
      <Labeled label="Número do cartão">
        <input
          className="input"
          value={card.number}
          onChange={(e) => set({ number: e.target.value })}
          inputMode="numeric"
          autoComplete="cc-number"
          required
        />
      </Labeled>
      <Labeled label="Nome impresso no cartão">
        <input
          className="input"
          value={card.holderName}
          onChange={(e) => set({ holderName: e.target.value })}
          autoComplete="cc-name"
          required
        />
      </Labeled>
      <div className="grid grid-cols-3 gap-2">
        <Labeled label="Mês">
          <input
            className="input"
            placeholder="MM"
            value={card.expMonth}
            onChange={(e) => set({ expMonth: e.target.value })}
            inputMode="numeric"
            autoComplete="cc-exp-month"
            required
          />
        </Labeled>
        <Labeled label="Ano">
          <input
            className="input"
            placeholder="AAAA"
            value={card.expYear}
            onChange={(e) => set({ expYear: e.target.value })}
            inputMode="numeric"
            autoComplete="cc-exp-year"
            required
          />
        </Labeled>
        <Labeled label="CVV">
          <input
            className="input"
            value={card.cvv}
            onChange={(e) => set({ cvv: e.target.value })}
            inputMode="numeric"
            autoComplete="cc-csc"
            required
          />
        </Labeled>
      </div>
    </div>
  );
}

const CHIP = "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors";

export function MethodChips<T extends string>({
  methods,
  value,
  onChange,
  accent,
  labels,
}: {
  methods: readonly T[];
  value: T;
  onChange: (m: T) => void;
  accent: string;
  labels: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pagamento">
      {methods.map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={CHIP}
            style={
              active
                ? { borderColor: accent, color: accent, background: "color-mix(in srgb, " + accent + " 8%, transparent)" }
                : { borderColor: "var(--color-line-strong)", color: "var(--color-muted)" }
            }
          >
            {labels[m] ?? m}
          </button>
        );
      })}
    </div>
  );
}

/** Pix "awaiting payment" panel — QR + copy-and-paste code + status note. */
export function AwaitingPix({
  heading,
  qrCodeUrl,
  qrCode,
  note = "Aguardando confirmação do pagamento…",
  children,
}: {
  heading: string;
  qrCodeUrl?: string;
  qrCode?: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div id="checkout" className={checkoutBox}>
      <h3 className="text-base font-semibold">{heading}</h3>
      {children}
      {qrCodeUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCodeUrl} alt="QR Code Pix" width={220} height={220} className="mt-4 rounded-lg" />
      )}
      {qrCode && (
        <div className="mt-3">
          <CopyButton text={qrCode} label="Copiar Pix copia e cola" />
          <code className="mt-2 block break-all rounded-md bg-canvas p-2 text-[0.7rem] text-muted">{qrCode}</code>
        </div>
      )}
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
        {note}
      </p>
    </div>
  );
}
