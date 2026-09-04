import { Lock } from "lucide-react";
import { LinkButton } from "@/components/ui";

const MODULE_LABEL: Record<string, string> = {
  crm: "CRM de doadores",
  raffles: "Rifas",
  events: "Eventos",
  auctions: "Leilões",
  sponsees: "Apadrinhamento",
  links: "Links de doação",
  ambassadors: "Embaixadores",
  intl: "Doação internacional",
};

/** Shown in place of a module's create UI when the org's plan doesn't include it. */
export function ModuleLockedNotice({ module, orgId }: { module: string; orgId: string }) {
  const label = MODULE_LABEL[module] ?? "Este recurso";
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-canvas text-muted">
        <Lock className="size-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">{label} não está no seu plano</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Faça upgrade para liberar {label.toLowerCase()}. Os itens já criados continuam visíveis, mas você não
        pode criar novos no plano atual.
      </p>
      <div className="mt-4">
        <LinkButton href={`/orgs/${orgId}/billing`} size="sm">
          Ver planos
        </LinkButton>
      </div>
    </div>
  );
}
