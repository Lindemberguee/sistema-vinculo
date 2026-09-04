import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui";

/** Centered card frame shared by the sign-in / register / reset / invite pages. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-6 place-items-center rounded-md bg-brand-600 text-white">♥</span>
        Plataforma de Doações
      </div>
      <Card>
        <CardBody>
          <h1 className="text-lg font-semibold">{title}</h1>
          {children}
        </CardBody>
      </Card>
    </main>
  );
}
