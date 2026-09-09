"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { tokenizeCard } from "./pagarme-browser";
import { resolveAccent } from "./accent";
import {
  brl,
  Labeled,
  FormSection,
  SegmentedControl,
  AmountGrid,
  MethodChips,
  CheckoutSubmit,
  ResultPanel,
  RecapRow,
  AwaitingPix,
  CardFields,
  BillingAddressFields,
  CheckRow,
  ToggleRow,
  emptyCard,
  useBillingAddress,
  useScrollToError,
  buildCardData,
  billingAddressBody,
  checkoutCard,
} from "./checkout-ui";

type Method = "PIX" | "CREDIT_CARD" | "BOLETO";
type Phase =
  | "form"
  | "submitting"
  | "awaiting_pix"
  | "awaiting_boleto"
  | "awaiting_card"
  | "paid"
  | "subscribed"
  | "failed";

const METHOD_LABEL: Record<Method, string> = { PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Map a raw acquirer/gateway reason to something a donor can act on. */
function friendlyDecline(reason?: string): string {
  const r = (reason ?? "").toLowerCase();
  if (!r) return "Pagamento não autorizado pelo emissor do cartão.";
  if (r.includes("insufficient") || r.includes("saldo") || r.includes("funds"))
    return "Cartão sem saldo/limite disponível.";
  if (r.includes("expired") || r.includes("expirou") || r.includes("venc")) return "Cartão vencido.";
  if (r.includes("cvv") || r.includes("security code") || r.includes("cvc"))
    return "Código de segurança (CVV) incorreto.";
  if (r.includes("billing") || r.includes("address") || r.includes("endereço"))
    return "Endereço de cobrança inválido ou incompleto.";
  if (r.includes("fraud") || r.includes("risk") || r.includes("antifraud"))
    return "Pagamento não autorizado por segurança. Tente outro cartão.";
  if (r.includes("do not honor") || r.includes("not honor") || r.includes("recus"))
    return "Pagamento recusado pelo emissor do cartão. Tente outro cartão.";
  return "Pagamento não autorizado. Verifique os dados ou tente outro cartão.";
}

export interface DonationCheckoutProps {
  campaignSlug: string;
  minAmountCents: number;
  suggestedAmountsCents: number[];
  methods: Method[];
  allowRecurring: boolean;
  allowTip: boolean;
  tipLabel: string;
  platformFeeBps: number;
  pagarmePublicKey: string;
  accentColor?: string;
  /** Apadrinhamento: lock to a monthly recurrence earmarked to this sponsee. */
  sponseeId?: string;
  heading?: string;
  /** Campaign rewards ("cotas") the donor can pick. `remaining` null = unlimited. */
  rewards?: {
    id: string;
    title: string;
    description: string | null;
    amountCents: number;
    remaining: number | null;
  }[];
  /** Show a "dedicate this donation" field. */
  dedicationEnabled?: boolean;
  /** Peer-to-peer: this donation is credited to an ambassador's page. */
  ambassadorId?: string;
  /** In-panel draft preview: render the form but block real submissions. */
  preview?: boolean;
}

/** Shape returned by GET /api/public/links/{slug} — a trackable donation link. */
interface LinkPreset {
  id: string;
  amountCents: number | null;
  lockAmount: boolean;
  suggestedAmountsCents: number[];
  defaultRecurring: boolean;
  defaultCoverFee: boolean;
  utm: Record<string, string>;
}

const REF_RE = /^[a-z0-9]{3,16}$/;

export function DonationCheckout(props: DonationCheckoutProps) {
  const accent = props.accentColor ?? "#006B4F";
  const pal = resolveAccent(accent);
  const isSponsorship = Boolean(props.sponseeId);

  const [amountCents, setAmountCents] = useState(
    props.suggestedAmountsCents[1] ?? props.suggestedAmountsCents[0] ?? 5000,
  );
  const methods = isSponsorship ? props.methods.filter((m) => m !== "BOLETO") : props.methods;
  const [method, setMethod] = useState<Method>(methods[0] ?? "PIX");
  const [recurring, setRecurring] = useState(isSponsorship);
  const [coverFee, setCoverFee] = useState(props.allowTip);
  const [suggested, setSuggested] = useState(props.suggestedAmountsCents);
  const [linkPreset, setLinkPreset] = useState<LinkPreset | null>(null);
  const lockedAmount = Boolean(linkPreset?.lockAmount && linkPreset.amountCents);

  useEffect(() => {
    if (isSponsorship || typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || !REF_RE.test(ref)) return;
    let cancelled = false;
    fetch(`/api/public/links/${ref}`, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? (r.json() as Promise<LinkPreset>) : null))
      .then((p) => {
        if (cancelled || !p) return;
        setLinkPreset(p);
        if (p.suggestedAmountsCents?.length) setSuggested(p.suggestedAmountsCents);
        if (p.amountCents && p.amountCents > 0) setAmountCents(p.amountCents);
        if (p.defaultRecurring && props.allowRecurring) setRecurring(true);
        if (p.defaultCoverFee && props.allowTip) setCoverFee(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [installments, setInstallments] = useState(1);
  const rewards = props.rewards ?? [];
  const [rewardId, setRewardId] = useState<string | null>(null);
  const selectedReward = rewards.find((r) => r.id === rewardId) ?? null;
  const [topUp, setTopUp] = useState(false);

  function pickReward(r: (typeof rewards)[number] | null) {
    setRewardId(r?.id ?? null);
    setTopUp(false);
    if (r) {
      setAmountCents(r.amountCents);
      setRecurring(false);
    }
  }

  const [donor, setDonor] = useState({ name: "", email: "", document: "", phone: "" });
  const [message, setMessage] = useState("");
  const [dedicate, setDedicate] = useState(false);
  const [dedication, setDedication] = useState({ to: "", message: "" });
  const [anonymous, setAnonymous] = useState(false);
  const [consentEmail, setConsentEmail] = useState(true);
  const [consentWhatsapp, setConsentWhatsapp] = useState(false);
  const [card, setCard] = useState(emptyCard);
  const { billing, setBilling, cepLoading, cepStatus, onCepBlur } = useBillingAddress();

  const [phase, setPhase] = useState<Phase>("form");
  const [formError, setFormError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { formRef, scrollToError } = useScrollToError();

  const monthly = recurring || isSponsorship;
  const needsPhone = method === "CREDIT_CARD" || method === "BOLETO";
  // Card path: the donor's CPF is the card-holder document (no field on the card
  // itself) and feeds the acquirer's anti-fraud customer object.
  const needsDocument = method === "CREDIT_CARD" || method === "BOLETO";
  const tipCents = useMemo(
    () => (coverFee ? Math.ceil((amountCents * props.platformFeeBps) / 10_000) : 0),
    [coverFee, amountCents, props.platformFeeBps],
  );
  const totalCents = amountCents + tipCents;
  const clearErr = (k: string) => setErrs((e) => (e[k] ? { ...e, [k]: "" } : e));

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
          setFormError("O pagamento não foi concluído. Tente novamente.");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (amountCents < props.minAmountCents)
      next.amount = `Valor mínimo: ${brl(props.minAmountCents)}`;
    if (donor.name.trim().length < 2) next.name = "Informe seu nome.";
    if (!EMAIL_RE.test(donor.email.trim())) next.email = "E-mail inválido.";
    if (needsPhone && donor.phone.replace(/\D/g, "").length < 10)
      next.phone = "Telefone com DDD é obrigatório.";
    if (needsDocument && donor.document.replace(/\D/g, "").length < 11)
      next.document = method === "BOLETO" ? "CPF/CNPJ é obrigatório para boleto." : "CPF do titular do cartão é obrigatório.";
    if (dedicate && !dedication.to.trim()) next.dedicateTo = "Informe a homenagem.";
    setErrs(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (props.preview) {
      setFormError("Pré-visualização: as doações só funcionam na página publicada.");
      return;
    }
    if (!validate()) {
      requestAnimationFrame(scrollToError);
      return;
    }

    let cardToken: string | undefined;
    if (method === "CREDIT_CARD") {
      const built = buildCardData(card, billing, donor.document);
      if ("error" in built) {
        setErrs((x) => ({ ...x, card: built.error }));
        requestAnimationFrame(scrollToError);
        return;
      }
      setPhase("submitting");
      try {
        cardToken = await tokenizeCard(props.pagarmePublicKey, built.data);
      } catch (err) {
        setPhase("failed");
        setFormError(err instanceof Error ? err.message : "Não foi possível validar o cartão.");
        return;
      }
    }

    setPhase("submitting");
    try {
      const res = await fetch("/api/public/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: props.campaignSlug,
          amountCents,
          tipCents,
          method,
          recurring: monthly,
          sponseeId: props.sponseeId,
          rewardId: rewardId ?? undefined,
          donationLinkId: linkPreset?.id,
          ambassadorId: props.ambassadorId,
          dedication:
            dedicate && dedication.to.trim()
              ? { to: dedication.to.trim(), message: dedication.message.trim() || undefined }
              : undefined,
          installments: method === "CREDIT_CARD" ? installments : undefined,
          cardToken,
          billingAddress: method === "CREDIT_CARD" ? billingAddressBody(billing) : undefined,
          anonymous,
          message: message || undefined,
          donor: {
            name: donor.name,
            email: donor.email,
            document: donor.document || undefined,
            phone: donor.phone || undefined,
          },
          consent: { email: consentEmail, whatsapp: consentWhatsapp },
          metadata: {
            referrer: typeof document !== "undefined" ? document.referrer : "",
            ...(linkPreset?.utm ?? {}),
          },
        }),
      });

      const body = (await res.json()) as {
        id?: string;
        status?: string;
        payment?: Record<string, unknown> | null;
        message?: string;
        error?: string;
        subscription?: boolean;
      };

      if (!res.ok || !body.id) {
        setPhase("failed");
        setFormError(
          method === "CREDIT_CARD"
            ? friendlyDecline(body.message ?? body.error)
            : body.message ?? body.error ?? "Não foi possível processar a doação.",
        );
        return;
      }

      setPayment(body.payment ?? null);
      if (body.subscription) setPhase("subscribed");
      else if (body.status === "PAID") setPhase("paid");
      else if (body.status === "FAILED") {
        setPhase("failed");
        setFormError(friendlyDecline(body.message));
      } else if (method === "PIX") {
        setPhase("awaiting_pix");
        startPolling(body.id);
      } else if (method === "BOLETO") {
        setPhase("awaiting_boleto");
        startPolling(body.id);
      } else {
        setPhase("awaiting_card");
        startPolling(body.id);
      }
    } catch (err) {
      setPhase("failed");
      setFormError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  // ── Result / waiting screens ───────────────────────────────────

  if (phase === "paid" || phase === "subscribed") {
    const sub = phase === "subscribed";
    return (
      <ResultPanel
        title={sub ? "Doação mensal ativada" : "Doação confirmada"}
        footer={
          <a href="#top" className="link">
            Voltar à campanha
          </a>
        }
      >
        <p>
          Obrigado{donor.name ? `, ${donor.name.split(" ")[0]}` : ""}! Enviamos o recibo para{" "}
          <span className="font-medium text-ink">{donor.email}</span>.
        </p>
        <dl className="mt-3 border-t border-line pt-3">
          <RecapRow label={sub ? "Valor mensal" : "Valor"} value={brl(totalCents)} />
          <RecapRow label="Forma de pagamento" value={METHOD_LABEL[method]} />
          {sub && <RecapRow label="Cobrança" value="Todo mês, até você cancelar" />}
        </dl>
      </ResultPanel>
    );
  }

  if (phase === "awaiting_pix") {
    const qr = payment as { qrCode?: string; qrCodeUrl?: string; expiresAt?: string } | null;
    return (
      <AwaitingPix
        heading="Escaneie para pagar com Pix"
        amountLabel={brl(totalCents)}
        qrCodeUrl={qr?.qrCodeUrl}
        qrCode={qr?.qrCode}
        expiresAt={qr?.expiresAt}
      />
    );
  }

  if (phase === "awaiting_boleto") {
    const bol = payment as { line?: string; pdfUrl?: string } | null;
    return (
      <div id="checkout" className={checkoutCard}>
        <h3 className="text-base font-semibold">Boleto gerado</h3>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{brl(totalCents)}</p>
        {bol?.line && (
          <code className="mt-3 block break-all rounded-md bg-canvas p-2 text-xs text-muted">
            {bol.line}
          </code>
        )}
        {bol?.pdfUrl && (
          <a
            href={bol.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full border border-line-strong px-4 text-sm font-medium hover:bg-canvas"
          >
            Abrir boleto em PDF
          </a>
        )}
        <p className="mt-3 text-sm text-muted">
          Enviamos o boleto por e-mail. A confirmação pode levar até 2 dias úteis.
        </p>
      </div>
    );
  }

  if (phase === "awaiting_card") {
    return (
      <ResultPanel tone="pending" title="Confirmando o pagamento…">
        <p>
          Seu cartão está sendo autorizado — costuma levar alguns segundos. Não feche esta página.
        </p>
      </ResultPanel>
    );
  }

  // ── Form ──────────────────────────────────────────────────────

  const busy = phase === "submitting";
  const showAmountPicker = !lockedAmount && !selectedReward;
  const canChooseFrequency = props.allowRecurring && !isSponsorship && !selectedReward && !lockedAmount;

  return (
    <form ref={formRef} id="checkout" onSubmit={onSubmit} className={checkoutCard}>
      <h3 className="text-lg font-semibold tracking-tight">
        {props.heading ?? (isSponsorship ? "Apadrinhar mensalmente" : "Fazer uma doação")}
      </h3>

      {rewards.length > 0 && !isSponsorship && (
        <FormSection title="Escolha uma cota" aside="opcional">
          <div className="grid gap-2">
            {rewards.map((r) => {
              const soldOut = r.remaining === 0;
              const active = rewardId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={soldOut}
                  onClick={() => pickReward(r)}
                  className="rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                  style={
                    active
                      ? { borderColor: pal.accent, background: pal.wash }
                      : { borderColor: "var(--color-line-strong)" }
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span
                      className="shrink-0 text-sm font-semibold tabular-nums"
                      style={{ color: pal.textInk }}
                    >
                      {brl(r.amountCents)}
                    </span>
                  </div>
                  {r.description && <p className="mt-0.5 text-xs text-muted">{r.description}</p>}
                  {soldOut ? (
                    <p className="mt-1 text-xs font-medium text-danger">Esgotada</p>
                  ) : (
                    r.remaining != null && (
                      <p className="mt-1 text-xs text-muted">{r.remaining} restantes</p>
                    )
                  )}
                </button>
              );
            })}
            {rewardId && (
              <button
                type="button"
                onClick={() => pickReward(null)}
                className="justify-self-start text-xs font-medium hover:underline"
                style={{ color: pal.textInk }}
              >
                Doar sem cota
              </button>
            )}
          </div>
        </FormSection>
      )}

      {canChooseFrequency && (
        <FormSection title="Frequência">
          <SegmentedControl
            ariaLabel="Frequência da doação"
            accent={accent}
            value={recurring ? "monthly" : "once"}
            onChange={(v) => setRecurring(v === "monthly")}
            options={[
              { value: "once", label: "Única" },
              { value: "monthly", label: "Mensal" },
            ]}
          />
        </FormSection>
      )}

      <FormSection title={monthly ? "Valor mensal" : "Valor"}>
        {showAmountPicker ? (
          <AmountGrid
            presets={suggested}
            valueCents={amountCents}
            onChange={(c) => {
              setAmountCents(c);
              clearErr("amount");
            }}
            allowCustom
            accent={accent}
            recurring={monthly}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: pal.textInk }}>
              {brl(amountCents)}
            </span>
            {selectedReward && !topUp && (
              <button
                type="button"
                onClick={() => setTopUp(true)}
                className="text-xs font-medium hover:underline"
                style={{ color: pal.textInk }}
              >
                Doar um valor maior
              </button>
            )}
          </div>
        )}
        {selectedReward && topUp && (
          <div className="mt-2">
            <Labeled label="Valor total da doação">
              <input
                className="input tabular-nums"
                inputMode="decimal"
                value={amountCents ? (amountCents / 100).toFixed(2) : ""}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "");
                  setAmountCents(Math.max(selectedReward.amountCents, d ? parseInt(d, 10) : 0));
                }}
              />
            </Labeled>
          </div>
        )}
        {errs.amount && (
          <p className="mt-1.5 text-xs text-danger" role="alert">
            {errs.amount}
          </p>
        )}
        {isSponsorship && (
          <p className="mt-2 text-xs text-muted">
            Cobrança mensal automática. Você pode cancelar quando quiser.
          </p>
        )}
        {props.allowTip && props.platformFeeBps > 0 && (
          <ToggleRow
            className="mt-3"
            checked={coverFee}
            onChange={setCoverFee}
            accent={accent}
            title={props.tipLabel}
            desc={`Some ${brl(Math.ceil((amountCents * props.platformFeeBps) / 10_000))} para cobrir a taxa de processamento — 100% da sua doação chega à organização.`}
          />
        )}
      </FormSection>

      <FormSection title="Forma de pagamento">
        <MethodChips methods={methods} value={method} onChange={setMethod} accent={accent} />

        {method === "CREDIT_CARD" && (
          <div className="mt-3 grid gap-3">
            <CardFields card={card} onChange={setCard} />
            <Labeled label="Parcelas">
              <select
                className="input"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {[1, 2, 3, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x {n > 1 ? `de ${brl(Math.ceil(totalCents / n))}` : "à vista"}
                  </option>
                ))}
              </select>
            </Labeled>
            <div>
              <p className="mb-1.5 text-[0.8125rem] font-medium text-ink">Endereço de cobrança</p>
              <BillingAddressFields
                value={billing}
                onChange={setBilling}
                onCepBlur={onCepBlur}
                loading={cepLoading}
                cepStatus={cepStatus}
              />
            </div>
            {errs.card && (
              <p className="text-xs text-danger" role="alert">
                {errs.card}
              </p>
            )}
          </div>
        )}
      </FormSection>

      <FormSection title="Seus dados">
        <div className="grid gap-2.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Labeled label="Nome" required error={errs.name}>
              <input
                className="input"
                autoComplete="name"
                value={donor.name}
                onChange={(e) => {
                  setDonor({ ...donor, name: e.target.value });
                  clearErr("name");
                }}
              />
            </Labeled>
            <Labeled label="E-mail" required error={errs.email}>
              <input
                type="email"
                className="input"
                autoComplete="email"
                value={donor.email}
                onChange={(e) => {
                  setDonor({ ...donor, email: e.target.value });
                  clearErr("email");
                }}
              />
            </Labeled>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Labeled
              label="CPF/CNPJ"
              optional={!needsDocument}
              required={needsDocument}
              error={errs.document}
            >
              <input
                className="input tabular-nums"
                inputMode="numeric"
                value={donor.document}
                onChange={(e) => {
                  setDonor({ ...donor, document: e.target.value });
                  clearErr("document");
                }}
              />
            </Labeled>
            <Labeled
              label="Telefone"
              optional={method === "PIX"}
              required={needsPhone}
              error={errs.phone}
            >
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={donor.phone}
                onChange={(e) => {
                  setDonor({ ...donor, phone: e.target.value });
                  clearErr("phone");
                }}
              />
            </Labeled>
          </div>
          <Labeled label="Mensagem para a organização" optional>
            <textarea
              className="input"
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Labeled>

          {props.dedicationEnabled && !isSponsorship && (
            <>
              <ToggleRow
                checked={dedicate}
                onChange={setDedicate}
                accent={accent}
                title="Dedicar esta doação a alguém"
              />
              {dedicate && (
                <div className="grid gap-2.5 rounded-xl bg-canvas p-3">
                  <Labeled label="Em homenagem a" required error={errs.dedicateTo}>
                    <input
                      className="input"
                      placeholder="Nome da pessoa homenageada"
                      value={dedication.to}
                      onChange={(e) => {
                        setDedication({ ...dedication, to: e.target.value });
                        clearErr("dedicateTo");
                      }}
                    />
                  </Labeled>
                  <Labeled label="Recado" optional>
                    <textarea
                      className="input"
                      rows={2}
                      value={dedication.message}
                      onChange={(e) => setDedication({ ...dedication, message: e.target.value })}
                    />
                  </Labeled>
                </div>
              )}
            </>
          )}

          <div className="mt-1 grid gap-2">
            <CheckRow checked={anonymous} onChange={setAnonymous} accent={accent}>
              Doar anonimamente
            </CheckRow>
            <CheckRow checked={consentEmail} onChange={setConsentEmail} accent={accent}>
              Aceito receber e-mails da organização
            </CheckRow>
            <CheckRow checked={consentWhatsapp} onChange={setConsentWhatsapp} accent={accent}>
              Aceito receber mensagens no WhatsApp
            </CheckRow>
          </div>
        </div>
      </FormSection>

      <dl className="mt-5 border-t border-line pt-4">
        <RecapRow label={monthly ? "Doação mensal" : "Doação"} value={brl(amountCents)} />
        {tipCents > 0 && <RecapRow label="Taxa coberta" value={brl(tipCents)} />}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
          <dt>Total{monthly ? " / mês" : ""}</dt>
          <dd className="tabular-nums" style={{ color: pal.textInk }}>
            {brl(totalCents)}
          </dd>
        </div>
      </dl>

      {formError && (
        <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
          {formError}
        </p>
      )}

      <CheckoutSubmit
        accent={accent}
        busy={busy}
        disabled={props.preview}
        label={props.preview ? "Pré-visualização — desativado" : `Doar ${brl(totalCents)}`}
        totalLabel={brl(totalCents)}
        footnote={
          props.preview ? (
            "Publique a campanha para receber doações por esta página."
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" aria-hidden />
              Pagamento seguro · dados do cartão não passam pelos nossos servidores
            </span>
          )
        }
      />
      {/* space so the mobile sticky bar never covers the footnote */}
      <div className="h-16 sm:hidden" aria-hidden />
    </form>
  );
}

