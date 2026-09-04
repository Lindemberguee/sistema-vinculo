import { NextResponse } from "next/server";
import { z } from "zod";
import { isAppError } from "@donation/shared";
import { requireOrgAccess } from "@/server/auth-helpers";
import { isStorageConfigured } from "@/env";
import {
  EMAIL_IMAGE_TYPES,
  MAX_EMAIL_IMAGE_BYTES,
  buildEmailAssetKey,
  presignUpload,
} from "@/server/storage";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

/** Hand the browser a presigned PUT for an e-mail image, plus the public URL to reference it by. */
export async function POST(req: Request) {
  if (!isStorageConfigured) {
    return NextResponse.json({ error: "storage_unconfigured" }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 422 });
  }
  const { organizationId, contentType, sizeBytes } = parsed.data;

  const ext = EMAIL_IMAGE_TYPES[contentType];
  if (!ext) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  if (sizeBytes > MAX_EMAIL_IMAGE_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  try {
    await requireOrgAccess(organizationId, "ADMIN");
    const key = buildEmailAssetKey(organizationId, ext);
    const uploadUrl = await presignUpload(key, contentType);
    return NextResponse.json({ uploadUrl, publicUrl: `/api/panel/email-assets/${key}` });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    console.error("email-assets upload-url error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
