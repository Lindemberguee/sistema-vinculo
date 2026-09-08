import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformAdminPage } from "@/server/admin-helpers";
import { cn } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/orgs", label: "Organizações" },
  { href: "/admin/users", label: "Usuários" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdminPage();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-surface px-4 py-5 lg:block">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">O</span>
          Ordfy Admin
        </div>
        <nav className="mt-8 grid gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={cn("rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-canvas hover:text-ink")}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-line bg-canvas p-3 text-xs text-muted">
          Logado como
          <div className="mt-1 truncate font-medium text-ink">{admin.email}</div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-sticky border-b border-line bg-surface/95 px-5 py-3 backdrop-blur lg:hidden">
          <div className="font-semibold">Ordfy Admin</div>
          <nav className="mt-3 flex gap-2 overflow-x-auto">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
