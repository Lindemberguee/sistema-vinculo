import { NextResponse } from "next/server";
import { prisma } from "@donation/db";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { presignDownload } from "@/server/storage";

export const runtime = "nodejs";

/** Redirects to a short-lived signed URL for the export CSV. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const row = await prisma.export.findUnique({
      where: { id },
      select: { organizationId: true, status: true, storageKey: true },
    });
    if (!row || row.status !== "DONE" || !row.storageKey) {
      return NextResponse.json({ error: "not_ready" }, { status: 404 });
    }

    await requireOrgAccess(row.organizationId, "FINANCE");

    const url = await presignDownload(row.storageKey);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    console.error("export download error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
