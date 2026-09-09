import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
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
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className={cn("mx-auto flex items-center gap-2.5 px-5 py-3 sm:px-6", max)}>
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

      <main className={cn("mx-auto w-full flex-1 px-5 py-8 sm:px-6 sm:py-12", max)}>{children}</main>

      <footer className="border-t border-line bg-surface py-5 text-center text-xs text-faint">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" aria-hidden />
          Pagamento processado com segurança
        </span>
      </footer>
    </div>
  );
}
