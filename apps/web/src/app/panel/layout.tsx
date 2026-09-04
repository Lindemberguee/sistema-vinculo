import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Providers } from "@/components/Providers";

/** Panel-wide client context (Auth.js SessionProvider) + the panel-scoped theme.
 * Public `sites/*` pages are outside this subtree — they never get `data-theme`
 * and stay provider-free. */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const dark = (await cookies()).get("theme")?.value === "dark";
  return (
    <div id="panel-root" data-theme={dark ? "dark" : undefined} className="min-h-screen bg-canvas text-ink">
      <Providers>{children}</Providers>
    </div>
  );
}
