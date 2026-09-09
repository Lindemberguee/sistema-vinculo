"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { tokenizeCard } from "./pagarme-browser";
import {
  brl,
  Labeled,
  FormSection,
  CardFields,
  BillingAddressFields,
  CheckRow,
  ToggleRow,
  CheckoutSubmit,
  ResultPanel,
  RecapRow,
  emptyCard,
  useBillingAddress,
  buildCardData,
  billingAddressBody,
  checkoutCard,
  MethodChips,
  AwaitingPix,
} from "./checkout-ui";

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
  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

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

  if (phase === "paid") {
    return (
      <ResultPanel
        title="Ingressos confirmados"
        footer={
          orderId && (
            <a className="link" href={`/e/pedido/${orderId}`} target="_blank" rel="noreferrer">
              Ver ingressos e QR Codes
            </a>
          )
        }
      >
        <p>Enviamos os ingressos para {donor.email}.</p>
        <dl className="mt-3 border-t border-line pt-3">
          <RecapRow label="Ingressos" value={totalTickets} />
          <RecapRow label="Total" value={brl(totalCents)} />
        </dl>
      </ResultPanel>
    );
  }

  if (phase === "awaiting") {
    if (method === "BOLETO") {
      return (
        <div className={checkoutCard}>
          <h3 className="text-base font-semibold">Boleto gerado</h3>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{brl(totalCents)}</p>
          {payment?.line && (
            <code className="mt-3 block break-all rounded-md bg-canvas p-2 text-xs text-muted">
              {payment.line}
            </code>
          )}
          {payment?.pdfUrl && (
            <a
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-canvas"
              href={payment.pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir boleto em PDF
            </a>
          )}
          <p className="mt-3 text-sm text-muted">
            Os ingressos ficam reservados até a confirmação do pagamento (até 2 dias úteis).
          </p>
        </div>
      );
    }
    return (
      <AwaitingPix
        heading="Escaneie para pagar com Pix"
        amountLabel={brl(totalCents)}
        qrCodeUrl={payment?.qrCodeUrl}
        qrCode={payment?.qrCode}
        note="Os ingressos ficam reservados até a confirmação do pagamento."
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <form onSubmit={onSubmit} className={checkoutCard}>
      <h3 className="text-lg font-semibold tracking-tight">{props.eventTitle}</h3>
      <p className="mt-0.5 text-sm text-muted">
        {props.venue} · {props.startsAtLabel}
      </p>

      <FormSection title="Ingressos">
        <div className="grid gap-2">
          {props.ticketTypes.map((t) => {
            const n = qty[t.id] ?? 0;
            const cap = Math.min(t.available, t.maxPerOrder);
            return (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line-strong p-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted">
                    {brl(t.priceCents)} · {t.available > 0 ? `${t.available} disponíveis` : "esgotado"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Remover ingresso ${t.name}`}
                    className="grid size-11 place-items-center rounded-lg border border-line-strong text-muted hover:bg-canvas disabled:opacity-40"
                    disabled={n === 0}
                    onClick={() => setQ(t.id, n - 1, cap)}
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">{n}</span>
                  <button
                    type="button"
                    aria-label={`Adicionar ingresso ${t.name}`}
                    className="grid size-11 place-items-center rounded-lg border border-line-strong text-muted hover:bg-canvas disabled:opacity-40"
                    disabled={n >= cap}
                    onClick={() => setQ(t.id, n + 1, cap)}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {props.askAttendeeNames && totalTickets > 0 && (
          <div className="mt-3 grid gap-2">
            {Array.from({ length: totalTickets }).map((_, i) => (
              <Labeled key={i} label={`Nome do participante ${i + 1}`}>
                <input
                  className="input"
                  value={attendees[i] ?? ""}
                  onChange={(e) => setAttendees((a) => Object.assign([...a], { [i]: e.target.value }))}
                />
              </Labeled>
            ))}
          </div>
        )}

        {props.allowTip && props.platformFeeBps > 0 && (
          <ToggleRow
            className="mt-3"
            checked={coverFee}
            onChange={setCoverFee}
            accent={accent}
            title={props.tipLabel}
            desc={`Some ${brl(Math.ceil((amountCents * props.platformFeeBps) / 10_000))} para cobrir a taxa de processamento.`}
          />
        )}
      </FormSection>

      <FormSection title="Pagamento">
        <MethodChips methods={["PIX", "CREDIT_CARD", "BOLETO"] as const} value={method} onChange={setMethod} accent={accent} />
        {method === "CREDIT_CARD" && (
          <div className="mt-3 grid gap-3">
            <CardFields card={card} onChange={setCard} />
            <div>
              <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">Endereço de cobrança</p>
              <BillingAddressFields value={billing} onChange={setBilling} onCepBlur={onCepBlur} loading={cepLoading} />
            </div>
          </div>
        )}
      </FormSection>

      <FormSection title="Seus dados">
        <div className="grid gap-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Labeled label="Nome" required>
              <input className="input" autoComplete="name" value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} />
            </Labeled>
            <Labeled label="E-mail" required>
              <input className="input" type="email" autoComplete="email" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} />
            </Labeled>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Labeled label="CPF/CNPJ" optional>
              <input className="input tabular-nums" inputMode="numeric" value={donor.document} onChange={(e) => setDonor({ ...donor, document: e.target.value })} />
            </Labeled>
            <Labeled label="Telefone" optional={method === "PIX"} required={method !== "PIX"}>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={donor.phone}
                onChange={(e) => setDonor({ ...donor, phone: e.target.value })}
              />
            </Labeled>
          </div>
          <CheckRow checked={consentEmail} onChange={setConsentEmail} accent={accent}>
            Aceito receber e-mails da organização
          </CheckRow>
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
        disabled={totalTickets === 0}
        label={
          totalTickets === 0
            ? "Selecione um ingresso"
            : `Comprar ${totalTickets} ingresso${totalTickets === 1 ? "" : "s"}`
        }
        totalLabel={brl(totalCents)}
      />
      <div className="h-16 sm:hidden" aria-hidden />
    </form>
  );
}
