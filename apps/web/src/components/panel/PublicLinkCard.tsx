import { CopyButton } from "@/components/public/CopyButton";
import { Card, CardBody } from "@/components/ui";
import { orgPublicOrigin } from "@/server/links/url";

/**
 * "Página pública" card for the panel — shows the shareable URL of a standalone
 * public page (raffle result, event tickets, auction lots) with a copy button.
 */
export function PublicLinkCard({ orgSlug, path, note }: { orgSlug: string; path: string; note?: string }) {
  const url = `${orgPublicOrigin({ slug: orgSlug })}${path}`;
  return (
    <Card>
      <CardBody>
        <h2 className="mb-1 text-sm font-semibold">Página pública</h2>
        {note && <p className="hint mb-2">{note}</p>}
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2.5 py-1.5 text-xs">{url}</code>
          <CopyButton text={url} label="Copiar" />
        </div>
      </CardBody>
    </Card>
  );
}
