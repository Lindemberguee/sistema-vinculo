import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, buildKycKey, presignUpload } from "@/server/storage";

export const runtime = "nodejs";

const KYC_KINDS = ["ESTATUTO", "ATA", "CARTAO_CNPJ", "DOC_RESPONSAVEL", "COMPROVANTE_BANCARIO"] as const;

const bodySchema = z.object({
  organizationId: z.string().min(1),
  kind: z.enum(KYC_KINDS),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 422 });
  }
  const { organizationId, kind, contentType, sizeBytes } = parsed.data;

  const ext = ALLOWED_UPLOAD_TYPES[contentType];
  if (!ext) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (sizeBytes > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  try {
    // Only OWNER/ADMIN of the org may upload KYC docs.
    await requireOrgAccess(organizationId, "ADMIN");

    const key = buildKycKey(organizationId, kind, ext);
    const uploadUrl = await presignUpload(key, contentType);
    return NextResponse.json({ uploadUrl, storageKey: key });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    console.error("kyc upload-url error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
