"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight } from "lucide-react";
import { PanelSidebar } from "@/components/PanelSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Membership {
  organizationId: string;
  displayName: string;
  role: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const SECTIONS: Record<string, { group?: string; label: string }> = {
  "": { label: "Início" },
  campaigns: { group: "Captação", label: "Campanhas" },
  raffles: { group: "Captação", label: "Rifas" },
  events: { group: "Captação", label: "Eventos" },
  auctions: { group: "Captação", label: "Leilões" },
  donors: { group: "Relacionamento", label: "Doadores" },
  tasks: { group: "Relacionamento", label: "Tarefas" },
  broadcasts: { group: "Relacionamento", label: "Comunicação" },
  sponsees: { group: "Relacionamento", label: "Apadrinhamento" },
  finance: { group: "Conta", label: "Finanças" },
  pagamentos: { group: "Conta", label: "Pagamentos" },
  exports: { group: "Conta", label: "Exportações" },
  team: { group: "Conta", label: "Equipe" },
  settings: { group: "Conta", label: "Configurações" },
  domains: { group: "Conta", label: "Domínios" },
  webhooks: { group: "Conta", label: "Webhooks" },
};

/** `/orgs/<id>/campaigns/<cid>/editor` → breadcrumb parts for the top bar. */
function breadcrumb(pathname: string, orgId: string) {
  const segs = pathname.split("/").filter(Boolean); // ["orgs", id, "campaigns", ...]
  const section = segs[1] === orgId ? (segs[2] ?? "") : "";
  const meta = SECTIONS[section] ?? { label: section };
  const isDeep = segs.length > (section ? 4 : 3);
  const base = `/orgs/${orgId}`;
  return {
    group: meta.group,
    label: meta.label,
    href: section ? `${base}/${section}` : base,
    deep: isDeep ? (segs[segs.length - 1] === "editor" ? "Editor" : "Detalhe") : null,
  };
}

const COLLAPSE_KEY = "panel:nav-collapsed";

export function PanelChrome({
  orgId,
  current,
  memberships,
  userName,
  banner,
  moduleAccess,
  children,
}: {
  orgId: string;
  current: Membership;
  memberships: Membership[];
  userName: string;
  banner?: ReactNode;
  moduleAccess?: Record<string, boolean>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="flex min-h-screen bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Pular para o conteúdo
      </a>

      {/* Desktop sidebar — sticky full-height rail */}
      <div className="hidden shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <PanelSidebar
            orgId={orgId}
            current={current}
            memberships={memberships}
            userName={userName}
            moduleAccess={moduleAccess}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navegação principal"
            className="absolute inset-y-0 left-0 flex"
          >
            <PanelSidebar
              orgId={orgId}
              current={current}
              memberships={memberships}
              userName={userName}
              moduleAccess={moduleAccess}
            />
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-2 top-3 grid size-8 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[120rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Abrir menu"
                aria-expanded={open}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink lg:hidden"
              >
                <Menu className="size-4" />
              </button>
              <nav aria-label="Trilha" className="flex min-w-0 items-center gap-1.5 text-ui">
                {(() => {
                  const b = breadcrumb(pathname, orgId);
                  return (
                    <>
                      {b.group && (
                        <>
                          <span className="hidden text-muted sm:inline">{b.group}</span>
                          <ChevronRight className="hidden size-3.5 shrink-0 text-faint sm:inline" />
                        </>
                      )}
                      {b.deep ? (
                        <Link href={b.href} className="truncate text-muted hover:text-ink">
                          {b.label}
                        </Link>
                      ) : (
                        <span className="truncate font-medium text-ink">{b.label}</span>
                      )}
                      {b.deep && (
                        <>
                          <ChevronRight className="size-3.5 shrink-0 text-faint" />
                          <span className="truncate font-medium text-ink">{b.deep}</span>
                        </>
                      )}
                    </>
                  );
                })()}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <span
                className="grid size-7 place-items-center rounded-full bg-brand-50 text-2xs font-semibold text-brand-700"
                title={userName}
              >
                {initials(userName)}
              </span>
            </div>
          </div>
        </header>

        <main id="conteudo" className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto w-full max-w-[120rem]">
            {banner}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
