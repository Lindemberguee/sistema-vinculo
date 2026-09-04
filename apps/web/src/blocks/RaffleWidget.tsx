"use client";

import { useMemo, useRef, useState } from "react";
import { tokenizeCard } from "./pagarme-browser";
import { brl, Labeled, CardFields, checkoutBox, MethodChips, AwaitingPix } from "./checkout-ui";

const METHOD_LABELS = { PIX: "Pix", CREDIT_CARD: "Cartão" };

type Phase = "form" | "submitting" | "awaiting_pix" | "paid" | "failed";

export interface RaffleWidgetProps {
  raffleId: string;
  title: string;
  prize: string;
  ticketPriceCents: number;
  totalNumbers: number;
  soldCount: number;
  minPerPurchase: number;
  maxPerPurchase: number;
  status: string;
  quickAmounts: number[];
  allowPickNumbers: boolean;
  allowTip: boolean;
  tipLabel: string;
  platformFeeBps: number;
  pagarmePublicKey: string;
  accentColor?: string;
}

export function RaffleWidget(props: RaffleWidgetProps) {
  const accent = props.accentColor ?? "#006B4F";
  const [mode, setMode] = useState<"quantity" | "numbers">("quantity");
  const [quantity, setQuantity] = useState(Math.max(props.minPerPurchase, props.quickAmounts[0] ?? 1));
  const [numbersRaw, setNumbersRaw] = useState("");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [coverFee, setCoverFee] = useState(props.allowTip);
  const [donor, setDonor] = useState({ name: "", email: "", document: "", phone: "" });
  const [consentEmail, setConsentEmail] = useState(true);
  const [card, setCard] = useState({ number: "", holderName: "", expMonth: "", expYear: "", cvv: "" });

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ qrCode?: string; qrCodeUrl?: string } | null>(null);
  const [gotNumbers, setGotNumbers] = useState<number[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickedNumbers = useMemo(
    () =>
      numbersRaw
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    [numbersRaw],
  );

  const count = mode === "numbers" ? pickedNumbers.length : quantity;
  const amountCents = count * props.ticketPriceCents;
  const tipCents = coverFee ? Math.ceil((amountCents * props.platformFeeBps) / 10_000) : 0;
  const totalCents = amountCents + tipCents;
  const remaining = props.totalNumbers - props.soldCount;

  function startPolling(donationId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/public/donations/${donationId}/status`);
        if (!r.ok) return;
        const s = (await r.json()) as { status: string };
        if (s.status === "PAID") {
          clearInterval(pollRef.current!);
          setPhase("paid");
        } else if (["FAILED", "EXPIRED", "CHARGED_BACK"].includes(s.status)) {
          clearInterval(pollRef.current!);
          setPhase("failed");
          setError("O pagamento não foi concluído — os números voltaram para a rifa.");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (count < props.minPerPurchase || count > props.maxPerPurchase) {
      setError(`Compre de ${props.minPerPurchase} a ${props.maxPerPurchase} números por vez.`);
      return;
    }
    setPhase("submitting");
    try {
      let cardToken: string | undefined;
      if (method === "CREDIT_CARD") {
        cardToken = await tokenizeCard(props.pagarmePublicKey, {
          number: card.number,
          holderName: card.holderName,
          expMonth: Number(card.expMonth),
          expYear: Number(card.expYear),
          cvv: card.cvv,
        });
      }
      const res = await fetch(`/api/public/raffles/${props.raffleId}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "numbers" ? { numbers: pickedNumbers } : { quantity }),
          method,
          cardToken,
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
        numbers?: number[];
        payment?: { qrCode?: string; qrCodeUrl?: string } | null;
        message?: string;
        error?: string;
      };
      if (!res.ok || !body.id) {
        setPhase("failed");
        setError(body.message ?? body.error ?? "Não foi possível reservar os números.");
        return;
      }
      setGotNumbers(body.numbers ?? []);
      setPayment(body.payment ?? null);
      if (body.status === "PAID") setPhase("paid");
      else {
        setPhase("awaiting_pix");
        startPolling(body.id);
      }
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  const box = checkoutBox;

  if (props.status !== "OPEN") {
    return (
      <div className={box}>
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {props.status === "DRAWN" ? "Esta rifa já foi sorteada." : "Esta rifa não está aberta para compra."}
        </p>
      </div>
    );
  }

  if (phase === "paid") {
    return (
      <div className={box}>
        <h3 className="text-base font-semibold">Números confirmados! 🎟️</h3>
        <p className="mt-1 text-sm">
          Seus números: <strong>{gotNumbers.join(", ")}</strong>. Boa sorte!
        </p>
      </div>
    );
  }

  if (phase === "awaiting_pix") {
    return (
      <AwaitingPix heading={`Pague ${brl(totalCents)} com Pix`} qrCodeUrl={payment?.qrCodeUrl} qrCode={payment?.qrCode}>
        <p className="mt-1 text-sm text-muted">
          Números reservados: <strong>{gotNumbers.join(", ")}</strong> — liberam se o pagamento não for concluído.
        </p>
      </AwaitingPix>
    );
  }

  const busy = phase === "submitting";

  return (
    <form id="checkout" onSubmit={onSubmit} className={box}>
      <h3 className="text-base font-semibold">{props.title}</h3>
      <p className="text-sm text-muted">
        Prêmio: {props.prize} · {brl(props.ticketPriceCents)}/número · {remaining} disponíveis
      </p>

      <div className="mt-4 flex gap-2 text-sm">
        <button type="button" onClick={() => setMode("quantity")} className={"rounded-full border px-3 py-1 " + (mode === "quantity" ? "border-brand-600 text-brand-600" : "border-line")}>
          Quantidade
        </button>
        {props.allowPickNumbers && (
          <button type="button" onClick={() => setMode("numbers")} className={"rounded-full border px-3 py-1 " + (mode === "numbers" ? "border-brand-600 text-brand-600" : "border-line")}>
            Escolher números
          </button>
        )}
      </div>

      {mode === "quantity" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {props.quickAmounts.map((q) => (
            <button key={q} type="button" onClick={() => setQuantity(q)} className={"rounded-full border px-3 py-2 text-sm " + (quantity === q ? "border-brand-600 text-brand-600" : "border-line-strong text-muted")}>
              {q}
            </button>
          ))}
          <input
            aria-label="Quantidade de números"
            type="number"
            min={props.minPerPurchase}
            max={props.maxPerPurchase}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="input w-20"
          />
        </div>
      ) : (
        <div className="mt-2">
          <Labeled label="Números escolhidos" hint="Separe por vírgula ou espaço.">
            <input
              className="input"
              placeholder="Ex.: 7, 42, 100"
              value={numbersRaw}
              onChange={(e) => setNumbersRaw(e.target.value)}
            />
          </Labeled>
        </div>
      )}

      {props.allowTip && props.platformFeeBps > 0 && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={coverFee} onChange={(e) => setCoverFee(e.target.checked)} />
          {props.tipLabel} (+{brl(tipCents)})
        </label>
      )}

      <div className="mt-3">
        <MethodChips methods={["PIX", "CREDIT_CARD"] as const} value={method} onChange={setMethod} accent={accent} labels={METHOD_LABELS} />
      </div>

      {method === "CREDIT_CARD" && (
        <div className="mt-3">
          <CardFields card={card} onChange={setCard} />
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
          <input className="input" value={donor.document} onChange={(e) => setDonor({ ...donor, document: e.target.value })} />
        </Labeled>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
          Aceito receber e-mails da organização
        </label>
      </div>

      {error && <p className="field-error mt-2">{error}</p>}

      <button type="submit" disabled={busy} className="mt-3 w-full rounded-full py-3 text-[15px] font-medium text-white disabled:opacity-50" style={{ background: accent }}>
        {busy ? "Processando…" : `Comprar ${count} número${count === 1 ? "" : "s"} — ${brl(totalCents)}`}
      </button>
    </form>
  );
}
