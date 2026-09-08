"use client";

import { useMemo, useRef, useState } from "react";
import { tokenizeCard } from "./pagarme-browser";
import {
  brl,
  Labeled,
  CardFields,
  BillingAddressFields,
  emptyCard,
  useBillingAddress,
  buildCardData,
  billingAddressBody,
  checkoutBox,
  MethodChips,
  AwaitingPix,
} from "./checkout-ui";

const METHOD_LABELS = { PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto" };

type Phase = "form" | "submitting" | "awaiting" | "paid" | "failed";

export interface EventCheckoutProps {
  eventId: string;
  eventTitle: string;
  venue: string;
  startsAtLabel: string;
  askAttendeeNames: boolean;
  ticketTypes: { id: string; name: string; priceCents: number; available: number; maxPerOrder: number }[];
  allowTip: boolean;
  tipLabel: string;
  platformFeeBps: number;
  pagarmePublicKey: string;
  accentColor?: string;
}

export function EventCheckout(props: EventCheckoutProps) {
  const accent = props.accentColor ?? "#006B4F";
  const [qty, setQty] = useState<Record<string, number>>({});
  const [attendees, setAttendees] = useState<string[]>([]);
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD" | "BOLETO">("PIX");
  const [coverFee, setCoverFee] = useState(props.allowTip);
  const [donor, setDonor] = useState({ name: "", email: "", document: "", phone: "" });
  const [consentEmail, setConsentEmail] = useState(true);
  const [card, setCard] = useState(emptyCard);
  const { billing, setBilling, cepLoading, onCepBlur } = useBillingAddress();

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ qrCode?: string; qrCodeUrl?: string; line?: string; pdfUrl?: string } | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const items = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
  const totalTickets = items.reduce((s, i) => s + i.quantity, 0);
  const amountCents = useMemo(
    () =>
      items.reduce((s, i) => {
        const t = props.ticketTypes.find((x) => x.id === i.ticketTypeId);
        return s + (t ? t.priceCents * i.quantity : 0);
      }, 0),
    [items, props.ticketTypes],
  );
  const tipCents = coverFee ? Math.ceil((amountCents * props.platformFeeBps) / 10_000) : 0;
  const totalCents = amountCents + tipCents;

  function setQ(id: string, n: number, max: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(n, max)) }));
  }

  function startPolling(id: string) {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/public/donations/${id}/status`);
        if (!r.ok) return;
        const s = (await r.json()) as { status: string };
        if (s.status === "PAID") {
          clearInterval(pollRef.current!);
          setPhase("paid");
        } else if (["FAILED", "EXPIRED", "CHARGED_BACK"].includes(s.status)) {
          clearInterval(pollRef.current!);
          setPhase("failed");
          setError("Pagamento não concluído — os ingressos foram liberados.");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (totalTickets === 0) {
      setError("Selecione ao menos um ingresso.");
      return;
    }
    if ((method === "CREDIT_CARD" || method === "BOLETO") && donor.phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone com DDD.");
      return;
    }

    let cardToken: string | undefined;
    if (method === "CREDIT_CARD") {
      const built = buildCardData(card, billing, donor.document);
      if ("error" in built) {
        setError(built.error);
        return;
      }
      setPhase("submitting");
      try {
        cardToken = await tokenizeCard(props.pagarmePublicKey, built.data);
      } catch (err) {
        setPhase("failed");
        setError(err instanceof Error ? err.message : "Não foi possível validar o cartão.");
        return;
      }
    }

    setPhase("submitting");
    try {
      const res = await fetch(`/api/public/events/${props.eventId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          attendees: props.askAttendeeNames ? attendees.slice(0, totalTickets) : undefined,
          method,
          cardToken,
          billingAddress: method === "CREDIT_CARD" ? billingAddressBody(billing) : undefined,
          tipCents,
          donor: {
            name: donor.name,
            email: donor.email,
            document: donor.document || undefined,
            phone: donor.phone || undefined,
          },
          consent: { email: consentEmail, whatsapp: false },
          metadata: {},
        }),
      });
      const body = (await res.json()) as {
        id?: string;
        status?: string;
        payment?: typeof payment;
        message?: string;
        error?: string;
      };
      if (!res.ok || !body.id) {
        setPhase("failed");
        setError(body.message ?? body.error ?? "Não foi possível reservar os ingressos.");
        return;
      }
      setOrderId(body.id);
      setPayment(body.payment ?? null);
      if (body.status === "PAID") setPhase("paid");
      else {
        setPhase("awaiting");
        startPolling(body.id);
      }
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  const box = checkoutBox;

  if (phase === "paid") {
    return (
      <div className={box}>
        <h3 className="text-base font-semibold">Ingressos confirmados! 🎫</h3>
        <p className="mt-1 text-sm">
          Enviamos por e-mail.{" "}
          {orderId && (
            <a className="link" href={`/e/pedido/${orderId}`} target="_blank" rel="noreferrer">
              Ver ingressos e QR Codes
            </a>
          )}
        </p>
      </div>
    );
  }

  if (phase === "awaiting") {
    if (method === "BOLETO") {
      return (
        <div className={box}>
          <h3 className="text-base font-semibold">Boleto gerado — {brl(totalCents)}</h3>
          {payment?.line && (
            <code className="mt-3 block break-all rounded-md bg-canvas p-2 text-xs text-muted">{payment.line}</code>
          )}
          {payment?.pdfUrl && (
            <p className="mt-2">
              <a className="link text-sm" href={payment.pdfUrl} target="_blank" rel="noreferrer">
                Abrir boleto em PDF
              </a>
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            Os ingressos ficam reservados até a confirmação do pagamento (até 2 dias úteis).
          </p>
        </div>
      );
    }
    return (
      <AwaitingPix
        heading={`Pague ${brl(totalCents)} com Pix`}
        qrCodeUrl={payment?.qrCodeUrl}
        qrCode={payment?.qrCode}
        note="Os ingressos ficam reservados até a confirmação do pagamento."
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <form onSubmit={onSubmit} className={box}>
      <h3 className="text-base font-semibold">{props.eventTitle}</h3>
      <p className="text-sm text-muted">
        {props.venue} · {props.startsAtLabel}
      </p>

      <div className="mt-4 grid gap-2">
        {props.ticketTypes.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
            <div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted">
                {brl(t.priceCents)} · {t.available > 0 ? `${t.available} disponíveis` : "esgotado"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={`Remover ingresso ${t.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-md border border-line px-2" onClick={() => setQ(t.id, (qty[t.id] ?? 0) - 1, Math.min(t.available, t.maxPerOrder))}>
                −
              </button>
              <span className="w-6 text-center tabular-nums">{qty[t.id] ?? 0}</span>
              <button type="button" aria-label={`Adicionar ingresso ${t.name}`} className="grid min-h-10 min-w-10 place-items-center rounded-md border border-line px-2" disabled={t.available === 0} onClick={() => setQ(t.id, (qty[t.id] ?? 0) + 1, Math.min(t.available, t.maxPerOrder))}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {props.askAttendeeNames && totalTickets > 0 && (
        <div className="mt-3 grid gap-2">
          <p className="text-sm font-semibold">Nome de quem vai usar cada ingresso</p>
          {Array.from({ length: totalTickets }).map((_, i) => (
            <input
              key={i}
              aria-label={`Nome do participante ${i + 1}`}
              className="input"
              placeholder={`Participante ${i + 1}`}
              value={attendees[i] ?? ""}
              onChange={(e) => setAttendees((a) => Object.assign([...a], { [i]: e.target.value }))}
            />
          ))}
        </div>
      )}

      {props.allowTip && props.platformFeeBps > 0 && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} />
          {props.tipLabel} (+{brl(tipCents)})
        </label>
      )}

      <div className="mt-3">
        <MethodChips methods={["PIX", "CREDIT_CARD", "BOLETO"] as const} value={method} onChange={setMethod} accent={accent} labels={METHOD_LABELS} />
      </div>

      {method === "CREDIT_CARD" && (
        <div className="mt-3 grid gap-2.5">
          <CardFields card={card} onChange={setCard} />
          <p className="mt-1 text-xs font-medium text-ink">Endereço de cobrança</p>
          <BillingAddressFields value={billing} onChange={setBilling} onCepBlur={onCepBlur} loading={cepLoading} />
        </div>
      )}

      <div className="mt-3 grid gap-2.5">
        <Labeled label="Nome">
          <input className="input" value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} required />
        </Labeled>
        <Labeled label="E-mail">
          <input className="input" type="email" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} required />
        </Labeled>
        <Labeled label="CPF/CNPJ" optional>
          <input className="input" value={donor.document} onChange={(e) => setDonor({ ...donor, document: e.target.value })} inputMode="numeric" />
        </Labeled>
        <Labeled label="Telefone" optional={method === "PIX"}>
          <input
            className="input"
            value={donor.phone}
            onChange={(e) => setDonor({ ...donor, phone: e.target.value })}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            required={method !== "PIX"}
          />
        </Labeled>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
          Aceito receber e-mails da organização
        </label>
      </div>

      {error && <p className="field-error mt-2" role="alert">{error}</p>}

      <button type="submit" disabled={busy} className="mt-3 w-full rounded-full py-3 text-[15px] font-medium text-white disabled:opacity-50" style={{ background: accent }}>
        {busy ? "Processando…" : `Comprar ${totalTickets} ingresso${totalTickets === 1 ? "" : "s"} — ${brl(totalCents)}`}
      </button>
    </form>
  );
}
