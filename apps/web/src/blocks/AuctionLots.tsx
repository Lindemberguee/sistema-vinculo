"use client";

import { useEffect, useState } from "react";

interface LotSeed {
  id: string;
  title: string;
  description: string;
  photoUrl: string | null;
  startPriceCents: number;
  minIncrementCents: number;
  currentBidCents: number | null;
  minNextCents: number;
  bidCount: number;
  endsAt: string;
  status: string;
}

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "encerrado";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min ${s % 60}s`;
}

export function AuctionLots({ lots: seed, columns, accent }: { lots: LotSeed[]; columns: number; accent: string }) {
  const [lots, setLots] = useState(seed);
  const [, tick] = useState(0);

  // Refresh state + countdown.
  useEffect(() => {
    const id = setInterval(async () => {
      tick((n) => n + 1);
      const updated = await Promise.all(
        lots.map(async (l) => {
          try {
            const r = await fetch(`/api/public/lots/${l.id}/state`);
            if (!r.ok) return l;
            const s = (await r.json()) as Partial<LotSeed>;
            return { ...l, ...s };
          } catch {
            return l;
          }
        }),
      );
      setLots(updated);
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="@container mx-auto max-w-4xl px-6 py-8">
      <div
        className="grid grid-cols-1 gap-4 @md:grid-cols-2 @xl:[grid-template-columns:repeat(var(--gcols),minmax(0,1fr))]"
        style={{ ["--gcols" as string]: String(columns) }}
      >
        {lots.map((l) => (
          <LotCard key={l.id} lot={l} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function LotCard({ lot, accent }: { lot: LotSeed; accent: string }) {
  const [amount, setAmount] = useState("");
  const [donor, setDonor] = useState({ name: "", email: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(lot);

  const ended = state.status !== "ACTIVE" || new Date(state.endsAt).getTime() <= Date.now();

  async function bid(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/public/lots/${lot.id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(Number(amount.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100),
          donor: { name: donor.name, email: donor.email },
          consent: { email: true, whatsapp: false },
        }),
      });
      const body = (await r.json()) as { currentBidCents?: number; minNextCents?: number; endsAt?: string; bidCount?: number; message?: string; error?: string };
      if (!r.ok) {
        setMsg(body.message ?? body.error ?? "Não foi possível registrar o lance.");
      } else {
        setState((s) => ({ ...s, currentBidCents: body.currentBidCents ?? s.currentBidCents, minNextCents: body.minNextCents ?? s.minNextCents, endsAt: body.endsAt ?? s.endsAt, bidCount: body.bidCount ?? s.bidCount }));
        setAmount("");
        setMsg("Lance registrado! Você lidera este lote.");
      }
    } catch {
      setMsg("Erro de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {state.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.photoUrl} alt={state.title} className="h-44 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="font-semibold">{state.title}</div>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{state.description}</p>
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <div>
            <div className="text-xs text-muted">Lance atual</div>
            <div className="text-lg font-semibold">
              {state.currentBidCents ? brl(state.currentBidCents) : `a partir de ${brl(state.startPriceCents)}`}
            </div>
          </div>
          <div className="text-right text-xs text-muted">
            {state.bidCount} lances · {ended ? "encerrado" : timeLeft(state.endsAt)}
          </div>
        </div>

        {ended ? (
          <p className="mt-3 text-sm text-muted">Este lote foi encerrado.</p>
        ) : (
          <form onSubmit={bid} className="mt-3 grid gap-2">
            <input
              className="input"
              inputMode="decimal"
              placeholder={`Mínimo ${brl(state.minNextCents)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Seu nome" value={donor.name} onChange={(e) => setDonor({ ...donor, name: e.target.value })} required />
              <input className="input" type="email" placeholder="E-mail" value={donor.email} onChange={(e) => setDonor({ ...donor, email: e.target.value })} required />
            </div>
            <button type="submit" disabled={busy} className="rounded-full py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: accent }}>
              {busy ? "Enviando…" : "Dar lance"}
            </button>
          </form>
        )}
        {msg && <p className={"mt-2 text-xs " + (msg.startsWith("Lance registrado") ? "text-success" : "text-danger")}>{msg}</p>}
      </div>
    </div>
  );
}
