"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const isSponsorship = Boolean(props.sponseeId);
  const [amountCents, setAmountCents] = useState(
    props.suggestedAmountsCents[1] ?? props.suggestedAmountsCents[0] ?? 5000,
  );
  const [customAmount, setCustomAmount] = useState("");
  // Sponsorship is card or Pix only (no boleto), always monthly.
  const methods = isSponsorship ? props.methods.filter((m) => m !== "BOLETO") : props.methods;
  const [method, setMethod] = useState<Method>(methods[0] ?? "PIX");
  const [recurring, setRecurring] = useState(isSponsorship);
  const [coverFee, setCoverFee] = useState(props.allowTip);
  const [suggested, setSuggested] = useState(props.suggestedAmountsCents);
  // Set once a visitor arriving through /l/{slug} is resolved.
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
        if (p.amountCents && p.amountCents > 0) {
          setAmountCents(p.amountCents);
          setCustomAmount("");
        }
        if (p.defaultRecurring && props.allowRecurring) setRecurring(true);
        if (p.defaultCoverFee && props.allowTip) setCoverFee(true);
      })
      .catch(() => {
        /* a dead link just behaves like a normal visit */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [installments, setInstallments] = useState(1);
  const rewards = props.rewards ?? [];
  const [rewardId, setRewardId] = useState<string | null>(null);
  const selectedReward = rewards.find((r) => r.id === rewardId) ?? null;

  function pickReward(r: (typeof rewards)[number] | null) {
    setRewardId(r?.id ?? null);
    setCustomAmount("");
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
  const { billing, setBilling, cepLoading, onCepBlur } = useBillingAddress();

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tipCents = useMemo(
    () => (coverFee ? Math.ceil((amountCents * props.platformFeeBps) / 10_000) : 0),
    [coverFee, amountCents, props.platformFeeBps],
  );
  const totalCents = amountCents + tipCents;

  function pickAmount(value: number) {
    setAmountCents(value);
    setCustomAmount("");
  }
  function onCustomAmount(raw: string) {
    setCustomAmount(raw);
    const cents = Math.round(Number(raw.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);
    if (Number.isFinite(cents) && cents > 0) setAmountCents(cents);
  }

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
          setError("O pagamento não foi concluído.");
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (props.preview) {
      setError("Pré-visualização: as doações só funcionam na página publicada.");
      return;
    }

    if (amountCents < props.minAmountCents) {
      setError(`Valor mínimo: ${brl(props.minAmountCents)}`);
      return;
    }

    const needsPhone = method === "CREDIT_CARD" || method === "BOLETO";
    if (needsPhone && donor.phone.replace(/\D/g, "").length < 10) {
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
      const res = await fetch("/api/public/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: props.campaignSlug,
          amountCents,
          tipCents,
          method,
          recurring: recurring || isSponsorship,
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
        setError(
          method === "CREDIT_CARD"
            ? friendlyDecline(body.message ?? body.error)
            : body.message ?? body.error ?? "Não foi possível processar a doação.",
        );
        return;
      }

      setPayment(body.payment ?? null);

      if (body.subscription) {
        setPhase("subscribed");
      } else if (body.status === "PAID") {
        setPhase("paid");
      } else if (body.status === "FAILED") {
        setPhase("failed");
        setError(friendlyDecline(body.message));
      } else if (method === "PIX") {
        setPhase("awaiting_pix");
        startPolling(body.id);
      } else if (method === "BOLETO") {
        setPhase("awaiting_boleto");
        startPolling(body.id);
      } else {
        // CREDIT_CARD came back PENDING (3-D Secure / async auth) — confirmed by webhook.
        setPhase("awaiting_card");
        startPolling(body.id);
      }
    } catch (err) {
      setPhase("failed");
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    }
  }

  if (phase === "paid") {
    return (
      <div id="checkout" className={checkoutBox}>
        <h3 className="text-base font-semibold">Doação confirmada! 💚</h3>
        <p className="mt-1 text-sm">
          Obrigado, {donor.name || "doador"}. Enviamos o recibo para {donor.email}.
        </p>
      </div>
    );
  }

  if (phase === "subscribed") {
    return (
      <div id="checkout" className={checkoutBox}>
        <h3 className="text-base font-semibold">Assinatura criada! 💚</h3>
        <p className="mt-1 text-sm">
          Obrigado, {donor.name || "doador"}. Sua doação mensal de {brl(totalCents)} foi ativada — a confirmação do
          primeiro pagamento chega em {donor.email}.
        </p>
      </div>
    );
  }

  if (phase === "awaiting_pix") {
    const qr = payment as { qrCode?: string; qrCodeUrl?: string } | null;
    return (
      <AwaitingPix heading={`Pague ${brl(totalCents)} com Pix`} qrCodeUrl={qr?.qrCodeUrl} qrCode={qr?.qrCode} />
    );
  }

  if (phase === "awaiting_boleto") {
    const bol = payment as { line?: string; pdfUrl?: string } | null;
    return (
      <div id="checkout" className={checkoutBox}>
        <h3 className="text-base font-semibold">Boleto gerado — {brl(totalCents)}</h3>
        {bol?.line && <code className="mt-2 block break-all text-xs">{bol.line}</code>}
        {bol?.pdfUrl && (
          <p className="mt-2">
            <a href={bol.pdfUrl} target="_blank" rel="noreferrer" className="link text-sm">
              Abrir boleto em PDF
            </a>
          </p>
        )}
        <p className="mt-2 text-sm text-muted">A confirmação pode levar até 2 dias úteis.</p>
      </div>
    );
  }

  if (phase === "awaiting_card") {
    return (
      <div id="checkout" className={checkoutBox}>
        <h3 className="text-base font-semibold">Confirmando o pagamento…</h3>
        <p className="mt-1 text-sm text-muted">
          Seu cartão está sendo autorizado. Isso costuma levar alguns segundos — não feche esta página.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-500" />
          Aguardando confirmação…
        </p>
      </div>
    );
  }

  const busy = phase === "submitting";

  const chipStyle = (active: boolean) =>
    active ? { borderColor: accent, color: accent } : { borderColor: "var(--color-line)", color: "var(--color-ink)" };

  return (
    <form id="checkout" onSubmit={onSubmit} className={checkoutBox}>
      <h3 className="mb-4 text-base font-semibold">
        {props.heading ?? (isSponsorship ? "Apadrinhar mensalmente" : "Fazer uma doação")}
      </h3>

      {rewards.length > 0 && !isSponsorship && (
        <fieldset className={fieldset}>
          <legend className={legend}>Escolha uma cota (opcional)</legend>
          <div className="grid gap-2">
            {rewards.map((r) => {
              const soldOut = r.remaining === 0;
              const active = rewardId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => pickReward(r)}
                  className="rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: active ? accent : "var(--color-line-strong)" }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="shrink-0 text-sm font-semibold" style={{ color: accent }}>
                      {brl(r.amountCents)}
                    </span>
                  </div>
                  {r.description && <p className="mt-0.5 text-xs text-muted">{r.description}</p>}
                  {soldOut ? (
                    <p className="mt-1 text-xs font-medium text-danger">Esgotada</p>
                  ) : (
                    r.remaining != null && <p className="mt-1 text-xs text-muted">{r.remaining} restantes</p>
                  )}
                </button>
              );
            })}
            {rewardId && (
              <button
                type="button"
                onClick={() => pickReward(null)}
                className="text-left text-xs font-medium text-brand-600 hover:underline"
              >
                Doar sem cota
              </button>
            )}
          </div>
        </fieldset>
      )}

      <fieldset className={fieldset}>
        <legend className={legend}>{isSponsorship ? "Valor mensal" : "Valor"}</legend>
        {lockedAmount && !selectedReward ? (
          <span className="text-lg font-semibold" style={{ color: accent }}>
            {brl(amountCents)}
          </span>
        ) : selectedReward ? (
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold" style={{ color: accent }}>
              {brl(amountCents)}
            </span>
            <input
              aria-label="Doar um valor maior"
              placeholder="Doar mais"
              value={customAmount}
              onChange={(e) => onCustomAmount(e.target.value)}
              inputMode="decimal"
              className="input w-28"
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {suggested.map((v) => {
              const active = amountCents === v && !customAmount;
              return (
                <button key={v} type="button" onClick={() => pickAmount(v)} className={chip} style={chipStyle(active)}>
                  {brl(v)}
                </button>
              );
            })}
            <input
              aria-label="Outro valor"
              placeholder="Outro valor"
              value={customAmount}
              onChange={(e) => onCustomAmount(e.target.value)}
              inputMode="decimal"
              className="input w-28"
            />
          </div>
        )}
        {isSponsorship ? (
          <p className="mt-2 text-xs text-muted">Cobrança mensal automática. Você pode cancelar quando quiser.</p>
        ) : (
          props.allowRecurring &&
          !selectedReward && (
            <label className={checkboxRow}>
              <input
                type="checkbox"
                className="size-4 accent-brand-600"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              Tornar mensal
            </label>
          )
        )}
        {props.allowTip && props.platformFeeBps > 0 && (
          <label className={checkboxRow}>
            <input
              type="checkbox"
              className="size-4 accent-brand-600"
              checked={coverFee}
              onChange={(e) => setCoverFee(e.target.checked)}
            />
            {props.tipLabel} (+{brl(tipCents)})
          </label>
        )}
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Forma de pagamento</legend>
        <MethodChips methods={methods} value={method} onChange={setMethod} accent={accent} labels={METHOD_LABELS} />

        {method === "CREDIT_CARD" && (
          <div className="mt-3 grid gap-2.5">
            <CardFields card={card} onChange={setCard} />
            <Labeled label="Parcelas">
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                className="input"
              >
                {[1, 2, 3, 6, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </Labeled>
            <p className="mt-1 text-xs font-medium text-ink">Endereço de cobrança</p>
            <BillingAddressFields
              value={billing}
              onChange={setBilling}
              onCepBlur={onCepBlur}
              loading={cepLoading}
            />
          </div>
        )}
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Seus dados</legend>
        <div className="grid gap-2.5">
          <Labeled label="Nome">
            <input value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} required className="input" />
          </Labeled>
          <Labeled label="E-mail">
            <input type="email" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} required className="input" />
          </Labeled>
          <Labeled label="CPF/CNPJ" optional={method !== "BOLETO"}>
            <input
              value={donor.document}
              onChange={(e) => setDonor({ ...donor, document: e.target.value })}
              className="input"
              inputMode="numeric"
              required={method === "BOLETO"}
            />
          </Labeled>
          <Labeled label="Telefone" optional={method === "PIX"}>
            <input
              value={donor.phone}
              onChange={(e) => setDonor({ ...donor, phone: e.target.value })}
              className="input"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              required={method !== "PIX"}
            />
          </Labeled>
          <Labeled label="Mensagem" optional>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="input" />
          </Labeled>
          {props.dedicationEnabled && !isSponsorship && (
            <>
              <label className={checkboxRow}>
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={dedicate}
                  onChange={(e) => setDedicate(e.target.checked)}
                />
                Dedicar esta doação a alguém
              </label>
              {dedicate && (
                <div className="grid gap-2">
                  <Labeled label="Em homenagem a">
                    <input
                      value={dedication.to}
                      onChange={(e) => setDedication({ ...dedication, to: e.target.value })}
                      className="input"
                      placeholder="Nome da pessoa homenageada"
                    />
                  </Labeled>
                  <Labeled label="Recado" optional>
                    <textarea
                      value={dedication.message}
                      onChange={(e) => setDedication({ ...dedication, message: e.target.value })}
                      rows={2}
                      className="input"
                    />
                  </Labeled>
                </div>
              )}
            </>
          )}
          <label className={checkboxRow}>
            <input type="checkbox" className="size-4 accent-brand-600" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Doar anonimamente
          </label>
          <label className={checkboxRow}>
            <input type="checkbox" className="size-4 accent-brand-600" checked={consentEmail} onChange={(e) => setConsentEmail(e.target.checked)} />
            Aceito receber e-mails da organização
          </label>
          <label className={checkboxRow}>
            <input type="checkbox" className="size-4 accent-brand-600" checked={consentWhatsapp} onChange={(e) => setConsentWhatsapp(e.target.checked)} />
            Aceito receber mensagens no WhatsApp
          </label>
        </div>
      </fieldset>

        {error && <p className="field-error mb-2" role="alert">{error}</p>}

      <button type="submit" disabled={busy || props.preview} className={submit} style={{ background: accent }}>
        {props.preview ? "Pré-visualização — doações desativadas" : busy ? "Processando…" : `Doar ${brl(totalCents)}`}
      </button>
      <p className="mt-2 text-xs text-muted">
        {props.preview
          ? "Publique a campanha para receber doações por esta página."
          : "Pagamento processado com segurança. Dados do cartão não passam pelos nossos servidores."}
      </p>
    </form>
  );
}

const fieldset = "mb-5 border-0 p-0";
const legend = "mb-2 text-sm font-semibold";
const chip = "rounded-full border px-3 py-2 text-sm transition-colors";
const checkboxRow = "mt-2 flex items-center gap-2 text-sm";
const submit = "mt-1 w-full rounded-full py-3 text-[15px] font-medium text-white disabled:opacity-50";
