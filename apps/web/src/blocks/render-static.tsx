import type { ReactNode } from "react";
import type { Block } from "@donation/blocks";
import { sanitizeRichText } from "./sanitize";
import { resolveEmbed, EMBED_PROVIDERS } from "./embed";
import { resolveAccent } from "./accent";
import { CountUpNumber } from "./CountUpNumber";

export { resolveAccent } from "./accent";

/**
 * Pure, isomorphic renderers for the "static" blocks — those whose output is a
 * function of `block.props` and a little campaign context, with no async/prisma.
 * Shared by the public server page (`render.tsx`) and the Studio canvas so the
 * editor preview matches production 1:1. NEVER import server-only or client-only
 * modules here.
 */

export type ButtonRadius = "full" | "md" | "none";

export interface StaticCtx {
  accent: string;
  /** Button corner style from the org's theme. */
  radius: ButtonRadius;
  raisedCents: number;
  goalCents: number | null;
  donorsCount: number;
  /** Plan doesn't allow hiding the platform footer → force it on. */
  forcePlatformBranding?: boolean;
}

/** Block types fully handled by `renderStaticBlock`. */
export const STATIC_TYPES = new Set<Block["type"]>([
  "hero",
  "richText",
  "image",
  "gallery",
  "progressBar",
  "amountOptions",
  "impactCounters",
  "testimonials",
  "faq",
  "videoEmbed",
  "cta",
  "footer",
  "imageText",
  "steps",
  "matchBanner",
  "embed",
  "allocation",
]);

const ALLOC_COLORS = ["bg-brand-500", "bg-brand-300", "bg-accent-400", "bg-faint", "bg-line-strong"];

const RATIO_PAD: Record<string, string> = { "16:9": "56.25%", "4:3": "75%", "1:1": "100%", "9:16": "177.78%" };

const brl = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);

const RADIUS_CLASS: Record<ButtonRadius, string> = {
  full: "rounded-full",
  md: "rounded-lg",
  none: "rounded-none",
};

/** Readable text colour on top of a solid accent fill (WCAG-picked). */
export function onAccent(hex: string): string {
  return resolveAccent(hex).onAccent;
}

export function renderStaticBlock(block: Block, ctx: StaticCtx): ReactNode {
  const a = resolveAccent(ctx.accent);
  const accent = a.accent; // fills
  const fg = a.onAccent; // text on a solid accent fill
  const ink = a.textInk; // accent-as-text on white
  const btn = `${RADIUS_CLASS[ctx.radius]} px-6 py-3 text-sm font-medium no-underline transition-opacity hover:opacity-90`;
  const cta = `mt-4 inline-block ${btn}`;

  switch (block.type) {
    case "hero":
      return (
        <section
          className="relative bg-cover bg-center px-6 py-20 text-center"
          style={{
            color: block.props.backgroundImageUrl ? "#fff" : undefined,
            backgroundImage: block.props.backgroundImageUrl ? `url(${block.props.backgroundImageUrl})` : undefined,
          }}
        >
          {block.props.backgroundImageUrl &&
            (() => {
              // Scrim gradient (heavier top/bottom) instead of a flat veil, so faces
              // aren't washed out; floor at 0.35 for title legibility.
              const o = Math.max(0.35, block.props.overlay);
              return (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${(o * 0.55).toFixed(2)}) 50%, rgba(0,0,0,${o}) 100%)`,
                  }}
                />
              );
            })()}
          <div className="relative mx-auto max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{block.props.title}</h1>
            {block.props.subtitle && <p className="mt-2 text-lg opacity-90">{block.props.subtitle}</p>}
            <a
              href={block.props.ctaTarget === "url" ? (block.props.ctaUrl ?? "#checkout") : "#checkout"}
              className={cta}
              style={{ background: accent, color: fg }}
            >
              {block.props.ctaLabel}
            </a>
          </div>
        </section>
      );

    case "richText":
      return (
        <div
          className={`mx-auto px-6 py-6 leading-relaxed ${block.props.maxWidth === "full" ? "max-w-full" : "max-w-[680px]"}`}
          // Sanitized on write; re-sanitized here so an unsaved editor value or a
          // legacy row can never inject markup.
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.props.html) }}
        />
      );

    case "image":
      return block.props.url ? (
        <figure className="mx-auto max-w-3xl px-6 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.props.url} alt={block.props.alt} className="w-full rounded-xl" />
          {block.props.caption && (
            <figcaption className="mt-2 text-center text-sm text-muted">{block.props.caption}</figcaption>
          )}
        </figure>
      ) : (
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="grid aspect-[16/9] place-items-center rounded-xl border border-dashed border-line-strong text-sm text-faint">
            Sem imagem
          </div>
        </div>
      );

    case "gallery":
      return (
        <div
          className="mx-auto grid max-w-4xl grid-cols-2 gap-2 px-6 py-6 @lg:[grid-template-columns:repeat(var(--gcols),minmax(0,1fr))]"
          style={{ ["--gcols" as string]: String(block.props.columns) }}
        >
          {block.props.images.length === 0 && (
            <div className="col-span-full grid h-32 place-items-center rounded-lg border border-dashed border-line-strong text-sm text-faint">
              Nenhuma imagem na galeria
            </div>
          )}
          {block.props.images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img.url} alt={img.alt} className="w-full rounded-lg" />
          ))}
        </div>
      );

    case "progressBar": {
      const { raisedCents, goalCents, donorsCount } = ctx;
      const pct = goalCents ? Math.min(100, Math.round((raisedCents / goalCents) * 100)) : null;
      return (
        <div className="mx-auto max-w-2xl px-6 py-6">
          {pct !== null && (
            <div className="h-3 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full animate-progress-fill"
                style={{ width: `${pct}%`, background: block.props.accentColor ?? accent }}
              />
            </div>
          )}
          {block.props.showValues && (
            <p className="mt-2 font-semibold">
              {brl(raisedCents)}
              {goalCents ? <span className="font-normal text-muted"> de {brl(goalCents)}</span> : null}
            </p>
          )}
          {block.props.showDonorsCount && <p className="text-sm text-muted">{donorsCount} pessoas já doaram</p>}
        </div>
      );
    }

    case "amountOptions":
      return (
        <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2 px-6 py-8">
          {block.props.amountsCents.map((c, i) => (
            <span
              key={i}
              className="rounded-full border px-4 py-2 text-sm font-medium"
              style={
                i === block.props.defaultIndex
                  ? { borderColor: accent, color: ink, background: a.wash }
                  : { borderColor: "var(--color-line-strong)", color: "var(--color-muted)" }
              }
            >
              {brl(c)}
            </span>
          ))}
          {block.props.allowCustom && (
            <span className="rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-faint">
              Outro valor
            </span>
          )}
        </div>
      );

    case "impactCounters":
      return (
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="grid divide-y divide-line rounded-2xl border border-line @lg:grid-cols-3 @lg:divide-x @lg:divide-y-0">
            {block.props.items.map((it, i) =>
              block.props.animate ? (
                <div key={i} className="px-6 py-6 text-center">
                  <CountUpNumber
                    value={it.value}
                    suffix={it.suffix}
                    className="text-4xl font-semibold tracking-tight tabular-nums"
                    style={{ color: ink }}
                  />
                  <div className="mt-1 text-sm text-muted">{it.label}</div>
                </div>
              ) : (
                <div key={i} className="px-6 py-6 text-center">
                  <div className="text-4xl font-semibold tracking-tight tabular-nums" style={{ color: ink }}>
                    {it.value.toLocaleString("pt-BR")}
                    {it.suffix}
                  </div>
                  <div className="mt-1 text-sm text-muted">{it.label}</div>
                </div>
              ),
            )}
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div className="mx-auto max-w-4xl px-6 py-10">
          {block.props.items.length === 0 ? (
            <div className="grid h-24 place-items-center rounded-xl border border-dashed border-line-strong text-sm text-faint">
              Nenhum depoimento
            </div>
          ) : (
            <div className="grid gap-4 @xl:grid-cols-2">
              {block.props.items.map((t, i) => (
                <figure key={i} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                  <span className="font-serif text-3xl leading-none" style={{ color: ink }} aria-hidden>
                    &ldquo;
                  </span>
                  <blockquote className="mt-1 flex-1 text-[0.95rem] leading-relaxed text-ink">{t.quote}</blockquote>
                  <figcaption className="mt-4 flex items-center gap-2.5">
                    {t.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
                    ) : (
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
                        style={{ background: a.wash, color: ink }}
                      >
                        {t.author.trim().charAt(0).toUpperCase() || "•"}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.author}</span>
                      {t.role && <span className="block truncate text-xs text-muted">{t.role}</span>}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      );

    case "faq":
      return (
        <div className="mx-auto max-w-[680px] px-6 py-8">
          {block.props.items.map((it, i) => (
            <details key={i} className="border-b border-line py-3">
              <summary className="cursor-pointer font-medium">{it.q || "Pergunta"}</summary>
              <p className="mt-1 text-muted">{it.a}</p>
            </details>
          ))}
        </div>
      );

    case "videoEmbed": {
      if (!block.props.videoId) {
        return (
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-line-strong text-sm text-faint">
              Informe o ID do vídeo
            </div>
          </div>
        );
      }
      const src =
        block.props.provider === "youtube"
          ? `https://www.youtube-nocookie.com/embed/${block.props.videoId}`
          : `https://player.vimeo.com/video/${block.props.videoId}`;
      return (
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="relative h-0 pb-[56.25%]">
            <iframe
              src={src}
              title="Vídeo da campanha"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full rounded-xl border-0"
            />
          </div>
        </div>
      );
    }

    case "cta":
      return (
        <section className="bg-canvas px-6 py-12 text-center">
          <h2 className="text-xl font-semibold">{block.props.title}</h2>
          {block.props.body && <p className="mt-1 text-muted">{block.props.body}</p>}
          <a
            href={block.props.target === "url" ? (block.props.url ?? "#checkout") : "#checkout"}
            className={cta}
            style={{ background: accent, color: fg }}
          >
            {block.props.buttonLabel}
          </a>
        </section>
      );

    case "imageText": {
      const img = block.props.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.props.imageUrl} alt={block.props.imageAlt} className="w-full rounded-2xl object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-faint">
          Sem imagem
        </div>
      );
      return (
        <div className="mx-auto grid max-w-4xl items-center gap-8 px-6 py-10 @2xl:grid-cols-2">
          <div className={block.props.imagePosition === "right" ? "@2xl:order-2" : undefined}>{img}</div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{block.props.title}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted">{block.props.body}</p>
            {block.props.ctaLabel && (
              <a
                href={block.props.ctaTarget === "url" ? (block.props.ctaUrl ?? "#checkout") : "#checkout"}
                className={cta}
                style={{ background: accent, color: fg }}
              >
                {block.props.ctaLabel}
              </a>
            )}
          </div>
        </div>
      );
    }

    case "steps":
      return (
        <div className="mx-auto max-w-3xl px-6 py-10">
          {block.props.title && <h2 className="mb-6 text-center text-xl font-semibold">{block.props.title}</h2>}
          <ol className="grid gap-4 @xl:grid-cols-3">
            {block.props.items.map((it, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface p-5">
                <span
                  className="grid size-8 place-items-center rounded-full text-sm font-semibold"
                  style={{ background: accent, color: fg }}
                >
                  {i + 1}
                </span>
                <div className="mt-3 font-medium">{it.title}</div>
                {it.body && <p className="mt-1 text-sm text-muted">{it.body}</p>}
              </li>
            ))}
          </ol>
        </div>
      );

    case "embed": {
      const e = resolveEmbed(block.props.url);
      if (!e.ok) {
        return (
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-6 text-center text-sm text-muted">
              {block.props.url
                ? `Este endereço não pode ser incorporado${e.provider ? ` — para ${e.provider}, use o link de “Incorporar”` : ""}.`
                : "Cole o link para incorporar."}
              <span className="mt-1 block text-xs text-faint">
                Suportado: {EMBED_PROVIDERS.join(" · ")}
              </span>
            </div>
          </div>
        );
      }
      return (
        <figure className="mx-auto max-w-3xl px-6 py-8">
          <div
            className="relative h-0 overflow-hidden rounded-xl border border-line"
            style={{ paddingBottom: RATIO_PAD[block.props.ratio] ?? "56.25%" }}
          >
            <iframe
              src={e.src}
              title={e.provider ?? "Conteúdo incorporado"}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
          {block.props.caption && (
            <figcaption className="mt-2 text-center text-sm text-muted">{block.props.caption}</figcaption>
          )}
        </figure>
      );
    }

    case "allocation": {
      const total = block.props.items.reduce((s, it) => s + it.amountCents, 0) || 1;
      return (
        <div className="mx-auto max-w-2xl px-6 py-10">
          <h2 className="text-lg font-semibold">{block.props.title}</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-canvas">
            {block.props.items.map((it, i) => (
              <div
                key={i}
                className={ALLOC_COLORS[i % ALLOC_COLORS.length]}
                style={{ width: `${(it.amountCents / total) * 100}%` }}
                title={it.label}
              />
            ))}
          </div>
          <dl className="mt-4 grid gap-2 @md:grid-cols-2">
            {block.props.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <dt className="flex items-center gap-1.5 text-muted">
                  <span className={`size-1.5 rounded-full ${ALLOC_COLORS[i % ALLOC_COLORS.length]}`} />
                  {it.label}
                </dt>
                <dd className="tabular-nums">
                  <span className="font-medium">{Math.round((it.amountCents / total) * 100)}%</span>
                  <span className="ml-1.5 text-muted">{brl(it.amountCents)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }

    case "matchBanner":
      return (
        <div className="px-6 py-4">
          <div
            className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl px-5 py-3.5 text-sm"
            style={{ background: a.wash, color: ink }}
          >
            <span className="text-lg leading-none" aria-hidden>
              ✦
            </span>
            <span className="font-medium text-ink">
              {block.props.text}
              {block.props.detail && <span className="font-normal text-muted"> — {block.props.detail}</span>}
              {block.props.until && <span className="font-normal text-muted"> (até {block.props.until})</span>}
            </span>
          </div>
        </div>
      );

    case "footer":
      return (
        <footer className="px-6 py-8 text-center text-sm text-muted">
          {block.props.text && <p>{block.props.text}</p>}
          {(block.props.showPlatformBranding || ctx.forcePlatformBranding) && (
            <p>Feito com a plataforma de doações.</p>
          )}
        </footer>
      );

    default:
      return null;
  }
}
