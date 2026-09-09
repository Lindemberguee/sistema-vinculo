"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Labeled, FormSection, CheckoutSubmit, checkoutCard } from "./checkout-ui";
import { resolveAccent } from "./accent";

export interface IntlDonationFormProps {
  campaignSlug: string;
  title: string;
  currencies: string[];
  suggestedAmounts: number[]; // major units
  accentColor?: string;
}

function fmt(major: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(major);
  } catch {
    return `${currency} ${major}`;
  }
}

export function IntlDonationForm(props: IntlDonationFormProps) {
  const accent = props.accentColor ?? "#006B4F";
  const pal = resolveAccent(accent);
  const [currency, setCurrency] = useState(props.currencies[0] ?? "USD");
  const [amountMajor, setAmountMajor] = useState(
    props.suggestedAmounts[1] ?? props.suggestedAmounts[0] ?? 25,
  );
  const [custom, setCustom] = useState("");
  const [donor, setDonor] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const major = custom ? Number(custom.replace(",", ".")) : amountMajor;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/donations/intl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: props.campaignSlug,
          currency,
          amountMinor: Math.round(major * 100),
          donor,
          consent: { email: true, whatsapp: false },
        }),
      });
      const body = (await res.json()) as { url?: string; message?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.message ?? body.error ?? "Could not start checkout.");
        setBusy(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={checkoutCard}>
      <h3 className="text-lg font-semibold tracking-tight">{props.title}</h3>
      <p className="mt-0.5 text-sm text-muted">
        Secure checkout by Stripe · billed in your card&rsquo;s currency.
      </p>

      <FormSection title="Amount">
        <div className="flex items-center gap-2">
          <Labeled label="Currency">
            <select
              className="input w-24"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {props.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Labeled>
          <div className="flex-1">
            <Labeled label="Custom amount">
              <input
                className="input"
                inputMode="decimal"
                placeholder="0"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </Labeled>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Amount">
          {props.suggestedAmounts.map((a) => {
            const active = amountMajor === a && !custom;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setAmountMajor(a);
                  setCustom("");
                }}
                className="relative grid min-h-11 place-items-center rounded-xl border px-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                style={
                  active
                    ? { borderColor: pal.accent, background: pal.wash, color: pal.textInk }
                    : { borderColor: "var(--color-line-strong)", color: "var(--color-ink)" }
                }
              >
                {active && (
                  <Check className="absolute right-1.5 top-1.5 size-3.5" style={{ color: pal.textInk }} aria-hidden />
                )}
                {fmt(a, currency)}
              </button>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Your details">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Labeled label="Name" required>
            <input
              className="input"
              autoComplete="name"
              value={donor.name}
              onChange={(e) => setDonor({ ...donor, name: e.target.value })}
              required
            />
          </Labeled>
          <Labeled label="Email" required>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={donor.email}
              onChange={(e) => setDonor({ ...donor, email: e.target.value })}
              required
            />
          </Labeled>
        </div>
      </FormSection>

      {error && (
        <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <CheckoutSubmit
        accent={accent}
        busy={busy}
        label="Continue to payment"
        totalLabel={major > 0 ? fmt(major, currency) : undefined}
      />
      <div className="h-16 sm:hidden" aria-hidden />
    </form>
  );
}
