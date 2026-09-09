"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tokenizeCard } from "./pagarme-browser";
import {
  brl,
  Labeled,
  FormSection,
  SegmentedControl,
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
import { resolveAccent } from "./accent";

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
  const pal = resolveAccent(accent);
  const [mode, setMode] = useState<"quantity" | "numbers">("quantity");
  const [quantity, setQuantity] = useState(Math.max(props.minPerPurchase, props.quickAmounts[0] ?? 1));
  const [numbersRaw, setNumbersRaw] = useState("");
  const [method, setMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [coverFee, setCoverFee] = useState(props.allowTip);
  const [donor, setDonor] = useState({ name: "", email: "", document: "", phone: "" });
  const [consentEmail, setConsentEmail] = useState(true);
  const [card, setCard] = useState(emptyCard);
  const { billing, setBilling, cepLoading, cepStatus, onCepBlur } = useBillingAddress();

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ qrCode?: string; qrCodeUrl?: string } | null>(null);
  const [gotNumbers, setGotNumbers] = useState<number[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

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
    if (method === "CREDIT_CARD" && donor.phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone com DDD.");
      return;
    }
    if (method === "CREDIT_CARD" && donor.document.replace(/\D/g, "").length < 11) {
      setError("Informe o CPF do titular do cartão.");
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
      const res = await fetch(`/api/public/raffles/${props.raffleId}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mode === "numbers" ? { numbers: pickedNumbers } : { quantity }),
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

  if (props.status !== "OPEN") {
    return (
      <div className={checkoutCard}>
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {props.status === "DRAWN" ? "Esta rifa já foi sorteada." : "Esta rifa não está aberta para compra."}
        </p>
      </div>
    );
  }

  if (phase === "paid") {
    return (
      <ResultPanel title="Números confirmados">
        <p>Boa sorte! Enviamos a confirmação para {donor.email}.</p>
        <dl className="mt-3 border-t border-line pt-3">
          <RecapRow label="Seus números" value={gotNumbers.join(", ") || "—"} />
          <RecapRow label="Total" value={brl(totalCents)} />
        </dl>
      </ResultPanel>
    );
  }

  if (phase === "awaiting_pix") {
    return (
      <AwaitingPix
        heading="Escaneie para pagar com Pix"
        amountLabel={brl(totalCents)}
        qrCodeUrl={payment?.qrCodeUrl}
        qrCode={payment?.qrCode}
      >
        <p className="mt-1 text-sm text-muted">
          Números reservados: <strong>{gotNumbers.join(", ")}</strong> — liberam se o pagamento não for concluído.
        </p>
      </AwaitingPix>
    );
  }

  const busy = phase === "submitting";

  return (
    <form id="checkout" onSubmit={onSubmit} className={checkoutCard}>
      <h3 className="text-lg font-semibold tracking-tight">{props.title}</h3>
      <p className="mt-0.5 text-sm text-muted">
        Prêmio: {props.prize} · {brl(props.ticketPriceCents)}/número · {remaining} disponíveis
      </p>

      <FormSection title="Números">
        {props.allowPickNumbers && (
          <SegmentedControl
            ariaLabel="Como escolher os números"
            accent={accent}
            value={mode}
            onChange={setMode}
            options={[
              { value: "quantity", label: "Quantidade" },
              { value: "numbers", label: "Escolher números" },
            ]}
          />
        )}

        {mode === "quantity" ? (
          <div className={props.allowPickNumbers ? "mt-3" : ""}>
            <div className="grid grid-cols-4 gap-2">
              {props.quickAmounts.map((q) => {
                const active = quantity === q;
                return (
                  <button
                    key={q}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setQuantity(q)}
                    className="grid min-h-11 place-items-center rounded-xl border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    style={
                      active
                        ? { borderColor: pal.accent, background: pal.wash, color: pal.textInk }
                        : { borderColor: "var(--color-line-strong)", color: "var(--color-ink)" }
                    }
                  >
                    {q}
                  </button>
                );
              })}
            </div>
            <Labeled className="mt-2" label="Outra quantidade">
              <input
                type="number"
                min={props.minPerPurchase}
                max={props.maxPerPurchase}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="input tabular-nums"
              />
            </Labeled>
          </div>
        ) : (
          <div className="mt-3">
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
        <MethodChips methods={["PIX", "CREDIT_CARD"] as const} value={method} onChange={setMethod} accent={accent} />
        {method === "CREDIT_CARD" && (
          <div className="mt-3 grid gap-3">
            <CardFields card={card} onChange={setCard} />
            <div>
              <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">Endereço de cobrança</p>
              <BillingAddressFields value={billing} onChange={setBilling} onCepBlur={onCepBlur} loading={cepLoading} cepStatus={cepStatus} />
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
            <Labeled label="CPF/CNPJ" optional={method !== "CREDIT_CARD"} required={method === "CREDIT_CARD"}>
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
        label={`Comprar ${count} número${count === 1 ? "" : "s"}`}
        totalLabel={brl(totalCents)}
      />
      <div className="h-16 sm:hidden" aria-hidden />
    </form>
  );
}
