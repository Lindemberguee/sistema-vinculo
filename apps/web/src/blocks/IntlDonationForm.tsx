"use client";

import { useState } from "react";
import { Labeled, checkoutBox } from "./checkout-ui";

export interface IntlDonationFormProps {
  campaignSlug: string;
  title: string;
  currencies: string[];
  suggestedAmounts: number[]; // major units
  accentColor?: string;
}

function fmt(major: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major}`;
  }
}

export function IntlDonationForm(props: IntlDonationFormProps) {
  const accent = props.accentColor ?? "#006B4F";
  const [currency, setCurrency] = useState(props.currencies[0] ?? "USD");
  const [amountMajor, setAmountMajor] = useState(props.suggestedAmounts[1] ?? props.suggestedAmounts[0] ?? 25);
  const [custom, setCustom] = useState("");
  const [donor, setDonor] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const major = custom ? Number(custom.replace(",", ".")) : amountMajor;
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
    <form onSubmit={onSubmit} className={checkoutBox}>
      <h3 className="text-base font-semibold">{props.title}</h3>
      <p className="text-sm text-muted">Secure checkout by Stripe. Card statement in your local currency.</p>

      <div className="mt-4 flex gap-2">
        <Labeled label="Currency">
          <select className="input w-24" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {props.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="flex-1">
          <Labeled label="Amount">
            <input
              className="input"
              inputMode="decimal"
              placeholder="Other amount"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </Labeled>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {props.suggestedAmounts.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAmountMajor(a);
              setCustom("");
            }}
            className="rounded-full border px-3 py-2 text-sm"
            style={amountMajor === a && !custom ? { borderColor: accent, color: accent } : { borderColor: "var(--color-line)" }}
          >
            {fmt(a, currency)}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2.5">
        <Labeled label="Name">
          <input className="input" value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} required />
        </Labeled>
        <Labeled label="Email">
          <input className="input" type="email" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} required />
        </Labeled>
      </div>

      {error && <p className="field-error mt-2" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="mt-3 w-full rounded-full py-3 text-[15px] font-medium text-white disabled:opacity-50" style={{ background: accent }}>
        {busy ? "Redirecting…" : "Continue to payment"}
      </button>
    </form>
  );
}
