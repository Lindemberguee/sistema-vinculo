"use client";

import { useCallback, useState, type ReactNode } from "react";
import { lookupCep, validateCard, type CardData } from "./pagarme-browser";
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
  holderDocument: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface BillingAddressState {
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export const emptyBillingAddress: BillingAddressState = {
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

export const emptyCard: CardState = {
  number: "",
  holderName: "",
  holderDocument: "",
  expMonth: "",
  expYear: "",
  cvv: "",
};

/** State + CEP auto-fill for the card billing address, shared by every checkout. */
export function useBillingAddress() {
  const [billing, setBilling] = useState<BillingAddressState>(emptyBillingAddress);
  const [cepLoading, setCepLoading] = useState(false);

  const onCepBlur = useCallback(async (rawCep: string) => {
    if (rawCep.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    try {
      const found = await lookupCep(rawCep);
      if (found) {
        setBilling((b) => ({
          ...b,
          street: found.street || b.street,
          neighborhood: found.neighborhood || b.neighborhood,
          city: found.city || b.city,
          state: found.state || b.state,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }, []);

  return { billing, setBilling, cepLoading, onCepBlur };
}

/**
 * Turn the checkout's card + billing form state into the `CardData` the browser
 * tokenizer needs. `fallbackDocument` is the donor's CPF (used when the card
 * form's own holder-document field is left blank). Returns a validation error
 * string, or the ready `CardData`.
 */
export function buildCardData(
  card: CardState,
  billing: BillingAddressState,
  fallbackDocument?: string,
): { error: string } | { data: CardData } {
  const data: CardData = {
    number: card.number,
    holderName: card.holderName,
    holderDocument: card.holderDocument || fallbackDocument || undefined,
    expMonth: Number(card.expMonth),
    expYear: Number(card.expYear),
    cvv: card.cvv,
    billingAddress: {
      line1: [billing.number, billing.street, billing.neighborhood].filter(Boolean).join(", "),
      line2: billing.complement || undefined,
      zipCode: billing.zipCode,
      city: billing.city,
      state: billing.state,
    },
  };
  const err = validateCard(data);
  return err ? { error: err } : { data };
}

/** The billing-address payload shape our donation/event/raffle APIs accept. */
export function billingAddressBody(billing: BillingAddressState) {
  return {
    line1: [billing.number, billing.street, billing.neighborhood].filter(Boolean).join(", "),
    line2: billing.complement || undefined,
    zipCode: billing.zipCode.replace(/\D/g, ""),
    city: billing.city,
    state: billing.state.toUpperCase().slice(0, 2),
  };
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
      <Labeled label="CPF do titular">
        <input
          className="input"
          value={card.holderDocument}
          onChange={(e) => set({ holderDocument: e.target.value })}
          inputMode="numeric"
          autoComplete="off"
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

/**
 * Billing address for card / boleto. CEP auto-fills street/neighborhood/city/UF
 * (all stay editable); the acquirer requires this for card charges.
 */
export function BillingAddressFields({
  value,
  onChange,
  onCepBlur,
  loading,
}: {
  value: BillingAddressState;
  onChange: (next: BillingAddressState) => void;
  onCepBlur: (cep: string) => void;
  loading?: boolean;
}) {
  const set = (patch: Partial<BillingAddressState>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-2.5">
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Labeled label="CEP" hint={loading ? "Buscando…" : undefined}>
          <input
            className="input"
            value={value.zipCode}
            onChange={(e) => set({ zipCode: e.target.value })}
            onBlur={(e) => onCepBlur(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            required
          />
        </Labeled>
        <Labeled label="Número">
          <input
            className="input"
            value={value.number}
            onChange={(e) => set({ number: e.target.value })}
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </Labeled>
      </div>
      <Labeled label="Rua">
        <input
          className="input"
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
          autoComplete="address-line1"
          required
        />
      </Labeled>
      <div className="grid grid-cols-2 gap-2">
        <Labeled label="Bairro">
          <input
            className="input"
            value={value.neighborhood}
            onChange={(e) => set({ neighborhood: e.target.value })}
            autoComplete="address-level3"
            required
          />
        </Labeled>
        <Labeled label="Complemento" optional>
          <input
            className="input"
            value={value.complement}
            onChange={(e) => set({ complement: e.target.value })}
            autoComplete="address-line2"
          />
        </Labeled>
      </div>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <Labeled label="Cidade">
          <input
            className="input"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
            autoComplete="address-level2"
            required
          />
        </Labeled>
        <Labeled label="UF">
          <input
            className="input uppercase"
            value={value.state}
            onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })}
            maxLength={2}
            autoComplete="address-level1"
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
