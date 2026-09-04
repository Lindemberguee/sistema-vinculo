"use client";

import { memo, useMemo } from "react";
import { Block, BLOCK_REGISTRY, type BlockType } from "@donation/blocks";
import { renderStaticBlock, STATIC_TYPES, type StaticCtx } from "@/blocks/render-static";
import { resolveEmbed } from "@/blocks/embed";
import { cn } from "@/components/ui";
import { BlockIcon } from "./block-icons";
import type { EditorBlock } from "./studio-reducer";

/**
 * Renders one block inside the canvas: a real inline preview for static blocks,
 * a solid non-interactive mock for configured data blocks, and a dashed "needs
 * setup" card only for genuinely unconfigured ones. Memoised — a `patchProps`
 * on one block re-parses/re-renders only that block.
 */
function CanvasBlockImpl({ block, ctx }: { block: EditorBlock; ctx: StaticCtx }) {
  const parsed = useMemo(() => Block.safeParse(block), [block]);

  // Third-party iframes are shown as a summary card in the editor, live only on the page.
  if (block.type === "embed") {
    const url = String((block.props as Record<string, unknown>).url ?? "");
    if (!url) return <NeedsSetup block={block} note="Cole o link para incorporar." />;
    const e = resolveEmbed(url);
    return (
      <NeedsSetup
        block={block}
        note={
          e.ok
            ? `${e.provider} — aparece incorporado na página publicada.`
            : "Este link não é de um provedor suportado."
        }
      />
    );
  }

  if (STATIC_TYPES.has(block.type)) {
    if (parsed.success) return <>{renderStaticBlock(parsed.data, ctx)}</>;
    return <NeedsSetup block={block} note="Preencha os campos ao lado para ver a prévia." />;
  }

  const missing = unconfiguredReason(block);
  if (missing) return <NeedsSetup block={block} note={missing} />;
  return <DataMock block={block} ctx={ctx} />;
}

export const CanvasBlock = memo(CanvasBlockImpl);

/** Data blocks that just need a linked entity / value before they can preview. */
function unconfiguredReason(block: EditorBlock): string | null {
  const p = block.props as Record<string, unknown>;
  if (block.type === "raffleWidget" && !p.raffleId) return "Selecione uma rifa nas configurações do bloco.";
  if (block.type === "eventTickets" && !p.eventId) return "Selecione um evento nas configurações do bloco.";
  if (block.type === "auctionLots" && !p.auctionId) return "Selecione um leilão nas configurações do bloco.";
  if (block.type === "countdown" && !p.deadline) return "Defina a data de encerramento.";
  if (block.type === "pixKey" && !p.keyValue) return "Informe a chave Pix.";
  return null;
}

function NeedsSetup({ block, note }: { block: EditorBlock; note: string }) {
  return (
    <div className="mx-auto my-4 flex max-w-2xl items-start gap-3 rounded-xl border border-dashed border-line-strong bg-canvas px-5 py-4">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-muted">
        <BlockIcon type={block.type} className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium">{BLOCK_REGISTRY[block.type].label}</div>
        <p className="mt-0.5 text-xs text-muted">{note}</p>
      </div>
    </div>
  );
}

/* ── Solid, styled, non-interactive mocks for always-on data blocks ── */

const fauxBtn = "inline-block rounded-full px-5 py-2.5 text-sm font-medium text-white";
const chip = "rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted";

function DataMock({ block, ctx }: { block: EditorBlock; ctx: StaticCtx }) {
  const p = block.props as Record<string, unknown>;

  switch (block.type as BlockType) {
    case "donationCheckout":
      return (
        <div className="mx-auto my-8 w-full max-w-[440px] rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="text-sm font-semibold">Fazer uma doação</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[2000, 5000, 10000].map((c) => (
              <span key={c} className={chip}>
                R$ {c / 100}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[0.6875rem] text-muted">
            {(Array.isArray(p.methods) ? p.methods : []).map((method) => (
              <span key={String(method)} className="rounded-full bg-canvas px-2 py-1">
                {method === "CREDIT_CARD" ? "Cartão" : String(method)}
              </span>
            ))}
            {p.allowRecurring === true && <span className="rounded-full bg-canvas px-2 py-1">Mensal</span>}
            {p.allowTip === true && <span className="rounded-full bg-canvas px-2 py-1">Contribuição extra</span>}
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-9 rounded-md border border-line-strong bg-canvas" />
            <div className="h-9 rounded-md border border-line-strong bg-canvas" />
          </div>
          <div className="mt-4 flex justify-center">
            <span className={fauxBtn} style={{ background: ctx.accent }}>
              Doar
            </span>
          </div>
        </div>
      );

    case "amountOptions": {
      const amounts = Array.isArray(p.amountsCents)
        ? p.amountsCents.filter((c): c is number => typeof c === "number" && c > 0)
        : [];
      const defaultIndex = typeof p.defaultIndex === "number" ? p.defaultIndex : 0;
      return (
        <div className="mx-auto my-8 flex max-w-xl flex-wrap justify-center gap-2">
          {amounts.map((c, i) => (
            <span
              key={`${c}-${i}`}
              className={cn(chip, i === defaultIndex && "border-brand-500 bg-brand-50 text-brand-700")}
            >
              R$ {(c / 100).toFixed(2).replace(".", ",")}
            </span>
          ))}
          {p.allowCustom !== false && <span className={chip}>Outro valor</span>}
        </div>
      );
    }

    case "sponseeGrid":
      return (
        <div className="mx-auto my-8 max-w-4xl px-6">
          <div className="mb-4 text-lg font-semibold">{String(p.title ?? "Escolha quem apadrinhar")}</div>
          <div
            className="grid gap-4 sm:[grid-template-columns:repeat(var(--gcols),minmax(0,1fr))]"
            style={{ ["--gcols" as string]: String(Math.min(Math.max(Number(p.columns) || 1, 1), 4)) }}
          >
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="h-28 bg-canvas" />
                <div className="space-y-1.5 p-3">
                  <div className="h-3 w-2/3 rounded bg-line" />
                  <div className="h-3 w-1/3 rounded bg-line" />
                  <span className={`${fauxBtn} mt-1 !px-4 !py-1.5 !text-xs`} style={{ background: ctx.accent }}>
                    Apadrinhar
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "raffleWidget":
      return (
        <div className="mx-auto my-8 w-full max-w-[440px] rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="text-sm font-semibold">Rifa</div>
          <p className="mt-1 text-xs text-muted">Escolha quantos números comprar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Array.isArray(p.quickAmounts) ? p.quickAmounts : []).map((n) => (
              <span key={n} className={chip}>
                {n}
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <span className={fauxBtn} style={{ background: ctx.accent }}>
              {p.allowPickNumbers ? "Escolher números" : "Comprar números"}
            </span>
          </div>
        </div>
      );

    case "eventTickets":
      return (
        <div className="mx-auto my-8 w-full max-w-[460px] rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="text-sm font-semibold">Ingressos</div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-line p-3">
            <div>
              <div className="text-sm font-medium">Inteira</div>
              <div className="text-xs text-muted">R$ 80,00</div>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <span className="grid size-6 place-items-center rounded-md border border-line">−</span>
              <span className="w-4 text-center">0</span>
              <span className="grid size-6 place-items-center rounded-md border border-line">+</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <span className={fauxBtn} style={{ background: ctx.accent }}>
              Comprar
            </span>
          </div>
          {p.askAttendeeNames === true && (
            <p className="mt-2 text-center text-xs text-muted">Nomes dos participantes serão solicitados.</p>
          )}
        </div>
      );

    case "auctionLots":
      return (
        <div
          className="mx-auto my-8 grid max-w-4xl gap-4 px-6 sm:[grid-template-columns:repeat(var(--gcols),minmax(0,1fr))]"
          style={{ ["--gcols" as string]: String(Math.min(Math.max(Number(p.columns) || 1, 1), 3)) }}
        >
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="h-32 bg-canvas" />
              <div className="space-y-1.5 p-4">
                <div className="h-3 w-2/3 rounded bg-line" />
                <div className="text-xs text-muted">Lance atual · R$ —</div>
                <span className={`${fauxBtn} mt-1 !px-4 !py-1.5 !text-xs`} style={{ background: ctx.accent }}>
                  Dar lance
                </span>
              </div>
            </div>
          ))}
        </div>
      );

    case "intlDonation":
      return (
        <div className="mx-auto my-8 w-full max-w-[420px] rounded-xl border border-line bg-surface p-5 shadow-card">
          <div className="text-sm font-semibold">{String(p.title ?? "Donate from abroad")}</div>
          <div className="mt-3 flex gap-2">
            <span className={`${chip} px-2`}>
              {String((Array.isArray(p.currencies) && p.currencies[0]) || "USD")} ▾
            </span>
            <div className="h-9 flex-1 rounded-md border border-line-strong bg-canvas" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Array.isArray(p.suggestedAmounts) ? p.suggestedAmounts : []).map((amount, index) => (
              <span key={`${String(amount)}-${index}`} className={chip}>
                {String(amount)}
              </span>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <span className={fauxBtn} style={{ background: ctx.accent }}>
              Continue to payment
            </span>
          </div>
        </div>
      );

    case "rewards":
      return (
        <div className="mx-auto my-8 max-w-4xl px-6">
          <div className="mb-4 font-semibold">{String(p.title ?? "Recompensas")}</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4">
                <div className="text-lg font-semibold" style={{ color: ctx.accent }}>
                  R$ —
                </div>
                <div className="mt-1 h-3 w-2/3 rounded bg-line" />
                <div className="mt-2 h-3 w-full rounded bg-line" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">As cotas cadastradas em Recompensas aparecem aqui.</p>
        </div>
      );

    case "campaignReports":
      return (
        <div className="mx-auto my-8 max-w-2xl px-6">
          <div className="font-semibold">{String(p.title ?? "Prestação de contas")}</div>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
            {[0, 1].map((i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3">
                <span className="h-3 w-40 rounded bg-line" />
                <span className="text-xs text-brand-600">Abrir ↗</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Os relatórios cadastrados em Impacto aparecem aqui.</p>
        </div>
      );

    case "ambassadorLeaderboard":
      return (
        <div className="mx-auto my-8 max-w-2xl px-6">
          <div className="mb-4 font-semibold">{String(p.title ?? "Embaixadores")}</div>
          <ol className="space-y-2 text-sm">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="text-sm font-semibold text-faint">{i}º</span>
                <span className="size-8 shrink-0 rounded-full bg-canvas" />
                <span className="h-3 w-32 rounded bg-line" />
                <span className="ml-auto h-3 w-16 rounded bg-line" />
              </li>
            ))}
          </ol>
          {p.showJoinCta !== false && (
            <div className="mt-4 text-center">
              <span className={fauxBtn} style={{ background: ctx.accent }}>
                Seja um embaixador
              </span>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">O ranking real aparece na página publicada.</p>
        </div>
      );

    case "campaignUpdates":
      return (
        <div className="mx-auto my-8 max-w-2xl px-6">
          <div className="mb-4 font-semibold">{String(p.title ?? "Novidades da campanha")}</div>
          <ol className="space-y-4 border-l border-line pl-5 text-sm">
            {[0, 1].map((i) => (
              <li key={i}>
                <div className="h-2.5 w-16 rounded bg-line" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-line" />
                <div className="mt-1.5 h-3 w-full rounded bg-line" />
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">As novidades cadastradas em Comunicação aparecem aqui.</p>
        </div>
      );

    case "donorWall":
      return (
        <div className="mx-auto my-8 max-w-3xl px-6">
          <div className="font-semibold">Quem já apoiou</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Ana", "Bruno", "Carla", "Diego", "Eva"].map((n) => (
              <span
                key={n}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm"
              >
                <span className="grid size-6 place-items-center rounded-full bg-canvas text-[0.625rem] font-semibold text-muted">
                  {n[0]}
                </span>
                {n}
              </span>
            ))}
          </div>
        </div>
      );

    case "countdown":
      return (
        <div className="mx-auto my-10 max-w-lg px-6 text-center">
          <div className="text-sm font-medium text-muted">{String(p.title ?? "A campanha encerra em")}</div>
          <div className="mt-3 flex justify-center gap-2.5">
            {["dias", "horas", "min", "seg"].map((u) => (
              <div key={u} className="min-w-[64px] rounded-xl border border-line bg-surface px-3 py-2.5">
                <div className="text-2xl font-semibold tabular-nums" style={{ color: ctx.accent }}>
                  00
                </div>
                <div className="text-[0.625rem] uppercase tracking-wide text-faint">{u}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case "pixKey":
      return (
        <div className="mx-auto my-10 max-w-md px-6">
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <div className="text-sm font-semibold">{String(p.title ?? "Doe direto pelo Pix")}</div>
            <div
              className="mt-3 break-all rounded-lg px-3 py-2.5 font-mono text-sm"
              style={{ background: `${ctx.accent}12` }}
            >
              {String(p.keyValue)}
            </div>
            <span className={`${chip} mt-3 inline-block`}>Copiar chave Pix</span>
          </div>
        </div>
      );

    default:
      return <NeedsSetup block={block} note="Aparece na página publicada." />;
  }
}
