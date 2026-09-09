"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Barcode, Check, CreditCard, Loader2, QrCode } from "lucide-react";
import { lookupCep, validateCard, type CardData } from "./pagarme-browser";
import { resolveAccent } from "./accent";
import { CopyButton } from "@/components/public/CopyButton";

export const brl = (c: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

/** Elevated surface for every public checkout widget. */
export const checkoutCard =
  "w-full max-w-[30rem] rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-6";
/** @deprecated use `checkoutCard` */
export const checkoutBox = checkoutCard;

// ─────────────────────────── Field ────────────────────────────────

/**
 * Public-page field wrapper. Mirrors the panel's `Field`: auto-wires
 * `aria-invalid` / `aria-describedby` onto its single child control and owns the
 * label + hint + error slots so call sites stay flat.
 */
export function Labeled({
  label,
  optional,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <label className={cx("grid gap-1", className)} data-invalid={error ? "" : undefined}>
      <span className="text-[0.8125rem] font-medium text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">(opcional)</span>}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </span>
      {control}
      {hint && !error && (
        <span id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="text-xs text-danger" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/** Titled group inside a checkout form. */
export function FormSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="mt-5 border-0 p-0 first:mt-0">
      <legend className="mb-2.5 flex w-full items-center justify-between gap-3 text-sm font-semibold text-ink">
        <span>{title}</span>
        {aside && <span className="text-xs font-normal text-muted">{aside}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ───────────────────────── Money input ────────────────────────────

/** BRL amount input with an `R$` adornment. Value flows as integer cents. */
export function MoneyInput({
  valueCents,
  onValueChange,
  placeholder = "0,00",
  autoFocus,
  ariaLabel,
  error,
}: {
  valueCents: number;
  onValueChange: (cents: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  error?: boolean;
}) {
  const shown =
    valueCents > 0
      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          valueCents / 100,
        )
      : "";
  return (
    <div
      className={cx(
        "flex items-center rounded-md border bg-surface transition-[border-color,box-shadow] duration-150 focus-within:ring-2 focus-within:ring-brand-500/15",
        error ? "border-danger" : "border-line-strong focus-within:border-brand-500",
      )}
    >
      <span className="pl-3 text-sm font-medium text-muted" aria-hidden>
        R$
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel ?? "Valor da doação"}
        aria-invalid={error || undefined}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
          onValueChange(digits ? parseInt(digits, 10) : 0);
        }}
        className="min-h-11 w-full bg-transparent px-2 text-sm text-ink tabular-nums placeholder:text-faint focus:outline-none"
      />
    </div>
  );
}

// ─────────────────────── Segmented control ────────────────────────

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accent,
  ariaLabel,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  accent: string;
  ariaLabel: string;
}) {
  const pal = resolveAccent(accent);
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-canvas p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            style={
              active
                ? { background: pal.accent, color: pal.onAccent }
                : { color: "var(--color-muted)" }
            }
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Amount grid ────────────────────────────

export function AmountGrid({
  presets,
  valueCents,
  onChange,
  allowCustom,
  accent,
  recurring,
}: {
  presets: number[];
  valueCents: number;
  onChange: (cents: number) => void;
  allowCustom: boolean;
  accent: string;
  recurring?: boolean;
}) {
  const pal = resolveAccent(accent);
  const isPreset = presets.includes(valueCents);
  const [customOpen, setCustomOpen] = useState(!isPreset && valueCents > 0);

  const cardBase =
    "relative flex min-h-12 items-center justify-center rounded-xl border px-2 py-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";

  const activeStyle = { borderColor: pal.accent, background: pal.wash, color: pal.textInk } as const;
  const idleStyle = { borderColor: "var(--color-line-strong)", color: "var(--color-ink)" } as const;

  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="Valor" className="grid grid-cols-3 gap-2">
        {presets.map((c) => {
          const active = !customOpen && valueCents === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setCustomOpen(false);
                onChange(c);
              }}
              className={cardBase}
              style={active ? activeStyle : idleStyle}
            >
              {active && (
                <Check
                  className="absolute right-1.5 top-1.5 size-3.5"
                  style={{ color: pal.textInk }}
                  aria-hidden
                />
              )}
              {brl(c)}
              {recurring && <span className="ml-0.5 text-[0.7rem] font-normal opacity-70">/mês</span>}
            </button>
          );
        })}
        {allowCustom && (
          <button
            type="button"
            role="radio"
            aria-checked={customOpen}
            onClick={() => {
              setCustomOpen(true);
              if (isPreset) onChange(0);
            }}
            className={cx(cardBase, "font-medium")}
            style={customOpen ? activeStyle : idleStyle}
          >
            Outro
          </button>
        )}
      </div>
      {customOpen && (
        <MoneyInput
          valueCents={valueCents}
          onValueChange={onChange}
          autoFocus
          ariaLabel="Outro valor de doação"
        />
      )}
    </div>
  );
}

// ─────────────────────── Payment method ───────────────────────────

const METHOD_META: Record<string, { label: string; icon: ReactNode }> = {
  PIX: { label: "Pix", icon: <QrCode className="size-4" aria-hidden /> },
  CREDIT_CARD: { label: "Cartão", icon: <CreditCard className="size-4" aria-hidden /> },
  BOLETO: { label: "Boleto", icon: <Barcode className="size-4" aria-hidden /> },
};

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
  /** Optional label overrides; defaults cover PIX / CREDIT_CARD / BOLETO. */
  labels?: Record<string, string>;
}) {
  const pal = resolveAccent(accent);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Forma de pagamento">
      {methods.map((m) => {
        const active = m === value;
        const meta = METHOD_META[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            style={
              active
                ? { borderColor: pal.accent, background: pal.wash, color: pal.textInk }
                : { borderColor: "var(--color-line-strong)", color: "var(--color-muted)" }
            }
          >
            {meta?.icon}
            {labels?.[m] ?? meta?.label ?? m}
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────── Submit / sticky bar ────────────────────

/**
 * Primary submit. Renders inline in the card, plus a mobile-only fixed bar so
 * the amount + action stay in view while the donor fills the form.
 */
export function CheckoutSubmit({
  label,
  totalLabel,
  busy,
  disabled,
  accent,
  footnote,
}: {
  label: string;
  totalLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  accent: string;
  footnote?: ReactNode;
}) {
  const pal = resolveAccent(accent);
  const btn = (
    <button
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-opacity hover:opacity-95 disabled:opacity-50"
      style={{ background: pal.accent, color: pal.onAccent }}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {busy ? "Processando…" : label}
    </button>
  );
  return (
    <>
      <div className="mt-4">{btn}</div>
      {footnote && <p className="mt-2 text-center text-xs text-muted">{footnote}</p>}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {totalLabel && (
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{totalLabel}</span>
        )}
        <div className="min-w-0 flex-1">{btn}</div>
      </div>
    </>
  );
}

// ─────────────────────────── Result panels ────────────────────────

export function ResultPanel({
  tone = "success",
  title,
  children,
  footer,
}: {
  tone?: "success" | "pending";
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div id="checkout" className={checkoutCard}>
      <span
        className={cx(
          "grid size-11 place-items-center rounded-full",
          tone === "success" ? "bg-success-bg text-success" : "bg-info-bg text-info",
        )}
      >
        {tone === "success" ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        )}
      </span>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {footer && <div className="mt-4 border-t border-line pt-4 text-sm">{footer}</div>}
    </div>
  );
}

/** key/value recap rows for the result / summary panels. */
export function RecapRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}

// ─────────────────────────── Pix waiting ──────────────────────────

function useCountdown(target?: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!target) {
      setLeft(null);
      return;
    }
    const end = new Date(target).getTime();
    if (Number.isNaN(end)) return;
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  if (left === null) return null;
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AwaitingPix({
  heading,
  amountLabel,
  qrCodeUrl,
  qrCode,
  expiresAt,
  note = "Assim que o pagamento cair, esta tela avança sozinha.",
  children,
}: {
  heading: string;
  amountLabel?: string;
  qrCodeUrl?: string;
  qrCode?: string;
  expiresAt?: string;
  note?: string;
  children?: ReactNode;
}) {
  const countdown = useCountdown(expiresAt);
  return (
    <div id="checkout" className={checkoutCard}>
      <h3 className="text-base font-semibold">{heading}</h3>
      {amountLabel && <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{amountLabel}</p>}
      {children}

      <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        {qrCodeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrCodeUrl}
            alt="QR Code Pix"
            width={200}
            height={200}
            className="mx-auto w-44 rounded-xl border border-line bg-surface p-2 sm:mx-0"
          />
        ) : (
          <div className="mx-auto grid size-44 place-items-center rounded-xl border border-dashed border-line-strong text-xs text-faint sm:mx-0">
            Gerando QR…
          </div>
        )}
        <ol className="grid list-decimal gap-1.5 pl-4 text-sm text-muted">
          <li>Abra o app do seu banco e escolha pagar com Pix.</li>
          <li>Escaneie o QR Code ou use o código “copia e cola”.</li>
          <li>Confirme o valor e finalize.</li>
        </ol>
      </div>

      {qrCode && (
        <div className="mt-3">
          <CopyButton text={qrCode} label="Copiar código Pix" />
          <code className="mt-2 block max-h-20 overflow-y-auto break-all rounded-md bg-canvas p-2 text-[0.7rem] leading-relaxed text-muted">
            {qrCode}
          </code>
        </div>
      )}

      <p
        className="mt-3 flex items-center gap-2 text-sm text-muted"
        role="status"
        aria-live="polite"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
        {countdown ? `Expira em ${countdown} · ${note}` : note}
      </p>
    </div>
  );
}

// ────────────────────── Card + billing fields ─────────────────────

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

const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const YEARS = Array.from({ length: 13 }, (_, i) => String(new Date().getFullYear() + i));

/** Credit-card inputs. Tokenized in the browser — never posted to our API. */
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
      <Labeled label="Número do cartão" required>
        <input
          className="input tabular-nums"
          value={card.number}
          onChange={(e) => set({ number: e.target.value })}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          maxLength={23}
        />
      </Labeled>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Labeled label="Nome impresso no cartão" required>
          <input
            className="input"
            value={card.holderName}
            onChange={(e) => set({ holderName: e.target.value })}
            autoComplete="cc-name"
          />
        </Labeled>
        <Labeled label="CPF do titular" required>
          <input
            className="input tabular-nums"
            value={card.holderDocument}
            onChange={(e) => set({ holderDocument: e.target.value })}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
          />
        </Labeled>
      </div>
      <div className="grid grid-cols-[1fr_1fr_5rem] gap-2">
        <Labeled label="Mês" required>
          <select
            className="input"
            value={card.expMonth}
            onChange={(e) => set({ expMonth: e.target.value })}
            autoComplete="cc-exp-month"
          >
            <option value="">MM</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Ano" required>
          <select
            className="input"
            value={card.expYear}
            onChange={(e) => set({ expYear: e.target.value })}
            autoComplete="cc-exp-year"
          >
            <option value="">AAAA</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="CVV" required>
          <input
            className="input tabular-nums"
            value={card.cvv}
            onChange={(e) => set({ cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
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
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <Labeled label="CEP" required hint={loading ? "Buscando…" : undefined}>
          <input
            className="input tabular-nums"
            value={value.zipCode}
            onChange={(e) => set({ zipCode: e.target.value })}
            onBlur={(e) => onCepBlur(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
          />
        </Labeled>
        <Labeled label="Número" required>
          <input
            className="input"
            value={value.number}
            onChange={(e) => set({ number: e.target.value })}
            inputMode="numeric"
            autoComplete="off"
          />
        </Labeled>
      </div>
      <Labeled label="Rua" required>
        <input
          className="input"
          value={value.street}
          onChange={(e) => set({ street: e.target.value })}
          autoComplete="address-line1"
        />
      </Labeled>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Labeled label="Bairro" required>
          <input
            className="input"
            value={value.neighborhood}
            onChange={(e) => set({ neighborhood: e.target.value })}
            autoComplete="address-level3"
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
      <div className="grid grid-cols-[1fr_4.5rem] gap-2">
        <Labeled label="Cidade" required>
          <input
            className="input"
            value={value.city}
            onChange={(e) => set({ city: e.target.value })}
            autoComplete="address-level2"
          />
        </Labeled>
        <Labeled label="UF" required>
          <input
            className="input uppercase"
            value={value.state}
            onChange={(e) => set({ state: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) })}
            maxLength={2}
            autoComplete="address-level1"
          />
        </Labeled>
      </div>
    </div>
  );
}

/** Scrolls the first `[aria-invalid]` / `.text-danger` into view. */
export function useScrollToError() {
  const ref = useRef<HTMLFormElement>(null);
  return {
    formRef: ref,
    scrollToError: useCallback(() => {
      const el = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el && "focus" in el) (el as HTMLElement).focus?.();
    }, []),
  };
}
