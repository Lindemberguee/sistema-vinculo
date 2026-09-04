"use client";

import { useMemo, useState } from "react";
import { Calculator, Check, Info, WalletCards } from "lucide-react";

type PaymentMethod = "pix" | "card";

const PAYMENT_METHODS: Record<PaymentMethod, { label: string; rate: number; fixed: number }> = {
  pix: { label: "Pix", rate: 0.0119, fixed: 0.99 },
  card: { label: "Cartão à vista", rate: 0.0439, fixed: 0.99 },
};

const COMPARISONS = [
  { label: "Doações", rate: 0, fixed: 0, note: "comissão da plataforma" },
  { label: "Vakinha", rate: 0.064, fixed: 0.5, note: "taxa publicada" },
  { label: "Doare Básico", rate: 0.062, fixed: 0.45, note: "taxa publicada" },
];

function parseAmount(value: string) {
  const normalized = value.includes(",")
    ? value.replace(/\./g, "").replace(",", ".")
    : value.replace(/[^\d.]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function DonationCalculator() {
  const [amountInput, setAmountInput] = useState("1000");
  const [method, setMethod] = useState<PaymentMethod>("pix");

  const calculation = useMemo(() => {
    const amount = parseAmount(amountInput);
    const gateway = PAYMENT_METHODS[method];
    const gatewayFee = amount * gateway.rate + gateway.fixed;
    const net = Math.max(0, amount - gatewayFee);
    const comparison = COMPARISONS.map((item) => ({
      ...item,
      fee: amount * item.rate + item.fixed,
      net: Math.max(0, amount - (amount * item.rate + item.fixed)),
    }));
    return { amount, gateway, gatewayFee, net, comparison };
  }, [amountInput, method]);

  return (
    <section id="simulador" className="scroll-mt-8 border-y border-[#dce9e2] bg-[#edf6f1] px-5 py-20 sm:px-8 md:py-28 lg:px-10">
      <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
        <div>
          <p className="eyebrow text-brand-600">Transparência no primeiro contato</p>
          <h2 className="mt-3 text-3xl leading-tight tracking-[-0.04em] sm:text-4xl">Calcule quanto chega para a sua causa.</h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">Informe o valor de uma doação e veja a estimativa das tarifas do gateway. A Doações não acrescenta comissão sobre a transação.</p>
          <div className="mt-7 space-y-3 text-sm text-muted">
            <div className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" /><span>Você vê o valor bruto, a tarifa e o líquido.</span></div>
            <div className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" /><span>A mensalidade da plataforma fica separada da doação.</span></div>
            <div className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" /><span>As referências podem ser ajustadas ao seu contrato.</span></div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[#cfe3d7] bg-white p-5 shadow-[0_18px_50px_rgb(20_60_42/0.08)] sm:p-7">
          <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-700"><Calculator className="size-4" aria-hidden="true" /></span>Simulador de doação</div>
              <label htmlFor="donation-amount" className="mt-7 block text-sm font-medium">Quanto você quer doar?</label>
              <div className="relative mt-2"><span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">R$</span><input id="donation-amount" value={amountInput} onChange={(event) => setAmountInput(event.target.value)} inputMode="decimal" autoComplete="off" className="input pl-10 text-lg font-semibold tabular-nums" aria-describedby="donation-amount-hint" /></div>
              <p id="donation-amount-hint" className="mt-2 text-xs text-muted">Use vírgula para centavos.</p>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Valores rápidos">
                {[100, 500, 1000, 5000].map((value) => <button key={value} type="button" onClick={() => setAmountInput(String(value))} className="min-h-9 rounded-full border border-line-strong bg-canvas px-3 text-xs font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500">{formatBRL(value)}</button>)}
              </div>
              <fieldset className="mt-7">
                <legend className="text-sm font-medium">Forma de pagamento</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((key) => {
                    const selected = method === key;
                    return <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm transition-colors ${selected ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line-strong bg-white text-muted hover:border-brand-200"}`}><input type="radio" name="payment-method" value={key} checked={selected} onChange={() => setMethod(key)} className="size-3.5 accent-brand-600" />{PAYMENT_METHODS[key].label}</label>;
                  })}
                </div>
              </fieldset>
            </div>

            <div className="rounded-2xl bg-[#0b382d] p-5 text-white sm:p-6">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-white/65">Estimativa para {PAYMENT_METHODS[method].label}</p><WalletCards className="size-4 text-[#8fe1bf]" aria-hidden="true" /></div>
              <p className="mt-5 text-xs uppercase tracking-[0.12em] text-white/50">A ONG recebe</p>
              <p className="mt-1 text-4xl font-semibold tracking-[-0.05em] text-[#8fe1bf]">{formatBRL(calculation.net)}</p>
              <div className="mt-6 space-y-3 border-t border-white/10 pt-4 text-sm"><div className="flex justify-between gap-4 text-white/68"><span>Valor da doação</span><span className="font-medium text-white">{formatBRL(calculation.amount)}</span></div><div className="flex justify-between gap-4 text-white/68"><span>Tarifa Pagar.me ({formatPercent(calculation.gateway.rate)} + {formatBRL(calculation.gateway.fixed)})</span><span className="font-medium text-[#f2c77a]">− {formatBRL(calculation.gatewayFee)}</span></div><div className="flex justify-between gap-4 text-white/68"><span>Comissão da plataforma</span><span className="font-medium text-[#8fe1bf]">R$ 0,00</span></div></div>
              <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 py-3 text-xs leading-5 text-white/60"><Info className="mr-1.5 inline size-3.5 align-[-2px] text-[#8fe1bf]" aria-hidden="true" />A tarifa exibida é uma referência pública e pode mudar conforme o seu contrato, prazo de recebimento e análise do gateway.</div>
            </div>
          </div>

          <div className="mt-7 border-t border-line pt-6"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold">Como fica em outras plataformas?</p><p className="mt-1 text-xs text-muted">Comparação da taxa sobre esta doação, sem mensalidades.</p></div><p className="text-[0.65rem] text-muted">Referências públicas · set/2026</p></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{calculation.comparison.map((item) => <div key={item.label} className={`rounded-xl border px-3.5 py-3 ${item.label === "Doações" ? "border-brand-200 bg-brand-50/70" : "border-line bg-canvas"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{item.label}</span>{item.label === "Doações" && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[0.6rem] font-medium text-brand-700">sem comissão</span>}</div><p className="mt-2 text-base font-semibold tabular-nums">{formatBRL(item.net)}</p><p className="mt-1 text-[0.65rem] text-muted">custo: {formatBRL(item.fee)} · {item.note}</p></div>)}</div><p className="mt-4 text-[0.68rem] leading-5 text-muted">A simulação usa as tarifas públicas de referência do Pagar.me, Vakinha e Doare. Confirme as condições do seu contrato antes de decidir; tarifas, planos e prazos podem mudar.</p><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted"><span>Fontes:</span><a href="https://www.pagar.me/oferta" target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-brand-700">Pagar.me</a><a href="https://www.vakinha.com.br/taxas-e-prazos" target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-brand-700">Vakinha</a><a href="https://doare.org/planos" target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-brand-700">Doare</a></div></div>
        </div>
      </div>
    </section>
  );
}
