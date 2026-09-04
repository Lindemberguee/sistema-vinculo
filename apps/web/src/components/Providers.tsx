"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

/** Client context providers mounted once at the app root. */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
