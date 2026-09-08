"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ChevronLeft,
  Monitor,
  Smartphone,
  Undo2,
  Redo2,
  ExternalLink,
  PanelLeft,
  PanelRight,
  X,
  Check,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { BLOCK_REGISTRY, type BlockType } from "@donation/blocks";
import { Button, cn } from "@/components/ui";
import { publishCampaign, saveDraftBlocks, saveOrgTheme } from "@/server/campaigns/actions";
import type { ButtonRadius } from "@/blocks/render-static";
import { studioReducer, initStudio, resolveDrop, type EditorBlock } from "./studio-reducer";
import { pendingBlocks } from "./block-status";
import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";

type SaveState = "idle" | "saving" | "saved" | "error";
export interface Theme {
  accent: string;
  radius: ButtonRadius;
}

export function Studio({
  orgId,
  campaignId,
  campaignTitle,
  campaignSlug,
  initialBlocks,
  campaignStats,
  initialTheme,
  seo,
  previewUrl,
  backUrl,
}: {
  orgId: string;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  initialBlocks: EditorBlock[];
  campaignStats: { raisedCents: number; goalCents: number | null; donorsCount: number };
  initialTheme: Theme;
  seo: { title: string; description: string };
  previewUrl: string;
  backUrl: string;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [state, dispatch] = useReducer(studioReducer, initialBlocks, initStudio);
  const [save, setSave] = useState<SaveState>("idle");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState<BlockType | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mobilePane, setMobilePane] = useState<"palette" | "inspector" | null>(null);
  const firstRender = useRef(true);
  const themeFirst = useRef(true);
  const saveReq = useRef(0);
  const themeReq = useRef(0);
  const paletteSearchRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = state.blocks.find((b) => b.id === state.selectedId) ?? null;
  const previewCtx = useMemo(
    () => ({ accent: theme.accent, radius: theme.radius, ...campaignStats }),
    [theme, campaignStats],
  );
  const pending = useMemo(() => pendingBlocks(state.blocks), [state.blocks]);

  // ── Autosave (debounced, last-write-wins) ──────────────────────────
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSave("saving");
    const id = ++saveReq.current;
    const t = setTimeout(async () => {
      const res = await saveDraftBlocks(orgId, campaignId, state.blocks);
      if (id !== saveReq.current) return; // a newer edit superseded this save
      setSave(res.ok ? "saved" : "error");
      setSaveMsg(res.ok ? null : (res.error ?? "Erro ao salvar"));
    }, 1200);
    return () => clearTimeout(t);
  }, [state.blocks, orgId, campaignId]);

  // ── Theme autosave ────────────────────────────────────────────────
  useEffect(() => {
    if (themeFirst.current) {
      themeFirst.current = false;
      return;
    }
    const id = ++themeReq.current;
    const t = setTimeout(() => {
      void saveOrgTheme(orgId, { primaryColor: theme.accent, buttonRadius: theme.radius }).then((res) => {
        if (id === themeReq.current && !res.ok) {
          setSave("error");
          setSaveMsg(res.error ?? "Erro ao salvar o tema");
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [theme, orgId]);

  // Warn before leaving with an unsaved / failed draft.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === "saving" || save === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

      if (e.key === "Escape") {
        if (mobilePane) setMobilePane(null);
        else dispatch({ type: "select", id: null });
        return;
      }
      if (typing) return;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (mod && e.key.toLowerCase() === "d" && state.selectedId) {
        e.preventDefault();
        dispatch({ type: "duplicate", id: state.selectedId });
      } else if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId) {
        e.preventDefault();
        dispatch({ type: "remove", id: state.selectedId });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.selectedId, mobilePane]);

  // ── Drag from palette / reorder ────────────────────────────────────
  const onDragStart = useCallback((e: DragStartEvent) => {
    setDragging(true);
    const data = e.active.data.current;
    if (data?.from === "palette") setDrag(data.blockType as BlockType);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setDrag(null);
      setDragging(false);
      const action = resolveDrop(
        state.blocks,
        e.active.data.current as { from?: string; blockType?: BlockType } | undefined,
        String(e.active.id),
        e.over ? String(e.over.id) : null,
      );
      if (action) dispatch(action);
    },
    [state.blocks],
  );

  const onAddClick = useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) paletteSearchRef.current?.focus();
    else setMobilePane("palette");
  }, []);
  const closeMobilePane = useCallback(() => setMobilePane(null), []);

  async function onPublish() {
    setPublishing(true);
    setPublishMsg(null);
    const res = await publishCampaign(orgId, campaignId);
    setPublishing(false);
    setPublishMsg(
      res.ok
        ? { ok: true, text: "Publicado! A página pública já reflete as mudanças." }
        : { ok: false, text: res.error ?? "Erro ao publicar" },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-canvas">
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line-strong bg-surface px-2 sm:gap-3 sm:px-3 lg:px-4">
        <Link
          href={backUrl}
          className="flex min-h-10 shrink-0 items-center gap-1 rounded-md px-1 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <ChevronLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Sair</span>
        </Link>
        <h1 className="sr-only min-w-0 flex-1 truncate text-sm font-semibold md:not-sr-only md:block">
          {campaignTitle}
        </h1>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          <SaveIndicator state={save} msg={saveMsg} />

          <div className="hidden items-center rounded-full border border-line-strong p-0.5 sm:flex">
            <IconToggle
              active={state.device === "desktop"}
              label="Visão desktop"
              onClick={() => dispatch({ type: "setDevice", device: "desktop" })}
            >
              <Monitor className="size-4" />
            </IconToggle>
            <IconToggle
              active={state.device === "mobile"}
              label="Visão mobile"
              onClick={() => dispatch({ type: "setDevice", device: "mobile" })}
            >
              <Smartphone className="size-4" />
            </IconToggle>
          </div>

          <div className="flex items-center gap-0.5">
            <IconBtn
              label="Desfazer (⌘Z)"
              disabled={state.past.length === 0}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 className="size-4" />
            </IconBtn>
            <IconBtn
              label="Refazer (⌘⇧Z)"
              disabled={state.future.length === 0}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 className="size-4" />
            </IconBtn>
          </div>

          {pending.length > 0 && (
            <span
              className="hidden items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[0.6875rem] font-medium text-warn sm:inline-flex"
              title={pending.map((p) => `${p.label}: ${p.issues.join(", ")}`).join("\n")}
            >
              <TriangleAlert className="size-3" />
              {pending.length} {pending.length === 1 ? "bloco incompleto" : "blocos incompletos"}
            </span>
          )}

          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary btn-sm hidden no-underline lg:inline-flex"
          >
            Pré-visualizar <ExternalLink className="size-3.5" />
          </a>
          <Button size="sm" onClick={onPublish} loading={publishing}>
            {publishing ? "Publicando…" : "Publicar"}
          </Button>

          <div className="flex items-center gap-0.5 lg:hidden">
            <IconBtn label="Blocos" onClick={() => setMobilePane((p) => (p === "palette" ? null : "palette"))}>
              <PanelLeft className="size-4" />
            </IconBtn>
            <IconBtn
              label="Configurações do bloco"
              onClick={() => setMobilePane((p) => (p === "inspector" ? null : "inspector"))}
            >
              <PanelRight className="size-4" />
            </IconBtn>
          </div>
        </div>
      </header>

      {publishMsg && (
        <p
          role={publishMsg.ok ? "status" : "alert"}
          aria-live="polite"
          className={cn(
            "shrink-0 px-4 py-1.5 text-xs",
            publishMsg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
          )}
        >
          {publishMsg.text}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => (setDrag(null), setDragging(false))}
      >
        <div className="grid min-h-0 flex-1 lg:grid-cols-[264px_minmax(0,1fr)_320px]">
          <aside className="hidden min-h-0 lg:block">
            <Palette dispatch={dispatch} searchRef={paletteSearchRef} />
          </aside>

          <section aria-label="Canvas da campanha" className="min-h-0">
            <Canvas
              blocks={state.blocks}
              selectedId={state.selectedId}
              device={state.device}
              dragging={dragging}
              ctx={previewCtx}
              dispatch={dispatch}
              onAddClick={onAddClick}
            />
          </section>

          <aside className="hidden min-h-0 lg:block">
            <Inspector
              orgId={orgId}
              campaignId={campaignId}
              campaignSlug={campaignSlug}
              seo={seo}
              theme={theme}
              onThemeChange={setTheme}
              selected={selected}
              dispatch={dispatch}
            />
          </aside>
        </div>

        {mobilePane && (
          <MobileDrawer
            side={mobilePane === "palette" ? "left" : "right"}
            title={mobilePane === "palette" ? "Adicionar bloco" : "Configurações"}
            onClose={closeMobilePane}
          >
            {mobilePane === "palette" ? (
              <Palette dispatch={dispatch} searchRef={paletteSearchRef} />
            ) : (
              <Inspector
                orgId={orgId}
                campaignId={campaignId}
                campaignSlug={campaignSlug}
                seo={seo}
                theme={theme}
                onThemeChange={setTheme}
                selected={selected}
                dispatch={dispatch}
              />
            )}
          </MobileDrawer>
        )}

        <DragOverlay dropAnimation={null}>
          {drag && (
            <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-card">
              {BLOCK_REGISTRY[drag].label}
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function MobileDrawer({
  side,
  title,
  onClose,
  children,
}: {
  side: "left" | "right";
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(
        ref.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.documentElement.classList.add("overflow-hidden");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.documentElement.classList.remove("overflow-hidden");
      opener.current?.focus();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        ref={ref}
        className={cn(
          "absolute inset-y-0 flex w-[288px] max-w-[85vw] flex-col bg-surface shadow-card",
          side === "left" ? "left-0" : "right-0",
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
          <span className="text-sm font-semibold">{title}</span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function SaveIndicator({ state, msg }: { state: SaveState; msg: string | null }) {
  if (state === "idle") return null;
  if (state === "saving")
    return (
      <span className="flex items-center gap-1 text-xs text-muted" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" />
        <span className="hidden sm:inline">salvando…</span>
      </span>
    );
  if (state === "saved")
    return (
      <span className="flex items-center gap-1 text-xs text-muted" aria-live="polite">
        <Check className="size-3.5 text-success" />
        <span className="hidden sm:inline">salvo</span>
      </span>
    );
  return (
    <span className="text-xs text-danger" role="alert">
      {msg ?? "erro ao salvar"}
    </span>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function IconToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center rounded-full transition-colors",
        active ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
