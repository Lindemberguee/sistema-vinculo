import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { resolveAccent } from "@/blocks/accent";

const WIDTHS = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" } as const;

/**
 * Frame for standalone donor-facing pages (ticket confirmation, lot payment,
 * sponsorship checkout). Block-composed campaign pages don't use this — they
 * bring their own header/footer blocks.
 */
export function PublicShell({
  org,
  width = "md",
  children,
}: {
  org: { displayName: string; logoUrl?: string | null; accent?: string | null };
  width?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  const max = WIDTHS[width];
  const initial = org.displayName.trim().charAt(0).toUpperCase() || "•";
  const pal = resolveAccent(org.accent);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className={cn("mx-auto flex items-center gap-2.5 px-6 py-3.5", max)}>
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.displayName} className="h-7 w-auto object-contain" />
          ) : (
            <span
              className="grid size-7 place-items-center rounded-md text-xs font-semibold"
              style={{ background: pal.accent, color: pal.onAccent }}
            >
              {initial}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{org.displayName}</span>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-6 py-10", max)}>{children}</main>

      <footer className="border-t border-line py-6 text-center text-xs text-faint">
        Pagamento processado com segurança · Feito com a plataforma de doações
      </footer>
    </div>
  );
}
