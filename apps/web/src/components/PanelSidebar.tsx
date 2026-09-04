"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Ticket,
  CalendarDays,
  Gavel,
  HeartHandshake,
  Users,
  UsersRound,
  ListChecks,
  Send,
  Wallet,
  CreditCard,
  Download,
  Settings,
  ChevronsUpDown,
  Plus,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";

interface Membership {
  organizationId: string;
  displayName: string;
  role: string;
}

interface NavItem {
  seg: string;
  label: string;
  icon: LucideIcon;
  /** Optional plan-gated module key; a lock is shown when the plan lacks it. */
  module?: string;
}

const NAV_GROUPS: { heading: string | null; items: NavItem[] }[] = [
  {
    heading: null,
    items: [{ seg: "", label: "Painel", icon: LayoutDashboard }],
  },
  {
    heading: "Captação",
    items: [
      { seg: "campaigns", label: "Campanhas", icon: Megaphone },
      { seg: "raffles", label: "Rifas", icon: Ticket, module: "raffles" },
      { seg: "events", label: "Eventos", icon: CalendarDays, module: "events" },
      { seg: "auctions", label: "Leilões", icon: Gavel, module: "auctions" },
    ],
  },
  {
    heading: "Relacionamento",
    items: [
      { seg: "donors", label: "Doadores", icon: Users, module: "crm" },
      { seg: "tasks", label: "Tarefas", icon: ListChecks, module: "crm" },
      { seg: "broadcasts", label: "Comunicação", icon: Send, module: "crm" },
      { seg: "sponsees", label: "Apadrinhamento", icon: HeartHandshake, module: "sponsees" },
    ],
  },
  {
    heading: "Conta",
    items: [
      { seg: "finance", label: "Finanças", icon: Wallet },
      { seg: "pagamentos", label: "Pagamentos", icon: CreditCard },
      { seg: "exports", label: "Exportações", icon: Download },
      { seg: "team", label: "Equipe", icon: UsersRound },
      { seg: "settings", label: "Configurações", icon: Settings },
    ],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function PanelSidebar({
  orgId,
  current,
  memberships,
  userName,
  moduleAccess,
  collapsed = false,
  onToggleCollapsed,
}: {
  orgId: string;
  current: Membership;
  memberships: Membership[];
  userName: string;
  /** Per-module access from the org's plan; a lock icon marks the ones it lacks. */
  moduleAccess?: Record<string, boolean>;
  /** Desktop icon-only rail. Ignored in the mobile drawer. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const base = `/orgs/${orgId}`;

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-full flex-col border-r border-line bg-surface transition-[width] duration-200",
        collapsed ? "w-[3.75rem]" : "w-64",
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-0" : "justify-between pl-4 pr-2",
        )}
      >
        <Link href={base} className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Doações — início">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-ui text-white">♥</span>
          {!collapsed && <span className="text-sm">Doações</span>}
        </Link>
        {onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Recolher menu"
            className="hidden size-8 place-items-center rounded-md text-faint hover:bg-canvas hover:text-ink lg:grid"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* Org switcher */}
      <div className={cn("shrink-0 border-b border-line", collapsed ? "flex justify-center py-2.5" : "px-3 py-2.5")}>
        {memberships.length > 1 && !collapsed ? (
          <details key={pathname} className="group relative">
            <summary
              aria-label={`Organização atual: ${current.displayName}. Trocar de organização`}
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-2xs font-semibold text-brand-700">
                {initials(current.displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium">{current.displayName}</span>
                <span className="block truncate text-2xs capitalize text-muted">{current.role.toLowerCase()}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
            </summary>
            <div className="org-switcher-popover absolute inset-x-0 z-20 mt-1 grid max-h-72 gap-0.5 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-card">
              {memberships.map((m) => (
                <Link
                  key={m.organizationId}
                  href={`/orgs/${m.organizationId}`}
                  className={cn(
                    "truncate rounded-md px-2.5 py-1.5 text-ui hover:bg-canvas",
                    m.organizationId === orgId && "font-medium text-brand-700",
                  )}
                >
                  {m.displayName}
                </Link>
              ))}
              <Link
                href="/onboarding"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ui text-muted hover:bg-canvas"
              >
                <Plus className="size-3.5" /> Nova organização
              </Link>
            </div>
          </details>
        ) : (
          <div
            className={cn("flex items-center gap-2", !collapsed && "px-2")}
            title={collapsed ? `${current.displayName} · ${current.role.toLowerCase()}` : undefined}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand-50 text-2xs font-semibold text-brand-700">
              {initials(current.displayName)}
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-ui font-medium">{current.displayName}</span>
                <span className="block truncate text-2xs capitalize text-muted">{current.role.toLowerCase()}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div
            key={group.heading ?? gi}
            className={cn(gi > 0 && (collapsed ? "mt-2 border-t border-line pt-2" : "mt-5"))}
          >
            {group.heading && !collapsed && <div className="eyebrow px-2.5 pb-1.5">{group.heading}</div>}
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const href = item.seg ? `${base}/${item.seg}` : base;
                const active = item.seg
                  ? pathname.startsWith(href)
                  : pathname === base || pathname === `${base}/`;
                const modLocked = Boolean(item.module && moduleAccess && moduleAccess[item.module] === false);
                const Icon = modLocked ? Lock : item.icon;
                return (
                  <Link
                    key={item.label}
                    href={href}
                    title={collapsed ? (modLocked ? `${item.label} (plano)` : item.label) : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg text-ui font-medium transition-colors",
                      collapsed ? "mx-auto size-9 justify-center" : "gap-2.5 px-2.5 py-2",
                      active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-canvas hover:text-ink",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute rounded-full bg-brand-600",
                          collapsed ? "inset-x-2 -bottom-px h-0.5" : "inset-y-1.5 left-0 w-[3px]",
                        )}
                      />
                    )}
                    <Icon
                      className={cn("size-4 shrink-0", active ? "text-brand-600" : "text-faint group-hover:text-muted")}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {onToggleCollapsed && collapsed && (
          <div className="mt-2 border-t border-line pt-2">
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expandir menu"
              className="mx-auto grid size-9 place-items-center rounded-lg text-faint hover:bg-canvas hover:text-ink"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("shrink-0 border-t border-line", collapsed ? "flex justify-center py-3" : "px-3 py-3")}>
        {collapsed ? (
          <Link
            href="/api/auth/signout"
            title={`Sair — ${userName}`}
            aria-label="Sair"
            className="grid size-9 place-items-center rounded-lg text-faint hover:bg-canvas hover:text-ink"
          >
            <LogOut className="size-4" />
          </Link>
        ) : (
          <div className="flex items-center gap-2 px-1">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-canvas text-2xs font-semibold text-muted">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-ui text-muted">{userName}</span>
            <Link
              href="/api/auth/signout"
              aria-label="Sair"
              className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-canvas hover:text-ink"
            >
              <LogOut className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
