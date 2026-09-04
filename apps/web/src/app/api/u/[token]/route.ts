import { prisma, verifyUnsubscribe } from "@donation/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, message: string, form?: string): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#f8f8f6;color:#17201c;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55}
.box{max-width:480px;margin:12vh auto;padding:32px 24px}.card{background:#fff;border:1px solid #ececeb;border-radius:16px;padding:32px}
h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#616b66;margin:0}
button{margin-top:20px;border:0;border-radius:999px;background:#006b4f;color:#fff;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}</style>
</head><body><div class="box"><div class="card"><h1>${title}</h1><p>${message}</p>${form ?? ""}</div></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

async function unsubscribe(token: string): Promise<boolean> {
  const v = verifyUnsubscribe(token);
  if (!v) return false;
  const donor = await prisma.donor.findFirst({
    where: { id: v.donorId, organizationId: v.organizationId },
    select: { id: true, email: true, consent: true },
  });
  if (!donor) return false;

  await prisma.$transaction([
    prisma.donorEmailStatus.upsert({
      where: { organizationId_email: { organizationId: v.organizationId, email: donor.email } },
      create: { organizationId: v.organizationId, email: donor.email, status: "UNSUBSCRIBED", reason: "one-click" },
      update: { status: "UNSUBSCRIBED", reason: "one-click", at: new Date() },
    }),
    prisma.donor.update({
      where: { id: donor.id },
      data: { consent: { ...((donor.consent ?? {}) as object), email: false, unsubscribedAt: new Date().toISOString() } },
    }),
  ]);
  return true;
}

/** RFC 8058 one-click unsubscribe (Gmail/Yahoo POST here). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await unsubscribe(token);
  return ok
    ? page("Pronto", "Você não receberá mais e-mails de divulgação desta organização.")
    : page("Link inválido", "Este link de descadastro expirou ou não é válido.");
}

/** Human landing — shows a confirm button. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!verifyUnsubscribe(token)) {
    return page("Link inválido", "Este link de descadastro expirou ou não é válido.");
  }
  return page(
    "Descadastrar",
    "Confirme para parar de receber e-mails de divulgação desta organização. Recibos e confirmações continuam sendo enviados.",
    `<form method="post"><button type="submit">Confirmar descadastro</button></form>`,
  );
}
