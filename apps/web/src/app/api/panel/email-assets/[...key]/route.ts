import { NextResponse } from "next/server";
import { fetchObject } from "@/server/storage";

export const runtime = "nodejs";

/**
 * Public read proxy for e-mail images. The bucket stays private; e-mail clients
 * fetch through here. Keys are random UUIDs under `email-assets/<orgId>/…`, so
 * they are effectively unguessable and safe to serve without auth.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.join("/");
  if (!key.startsWith("email-assets/") || key.includes("..")) {
    return new NextResponse("not found", { status: 404 });
  }

  try {
    const obj = await fetchObject(key);
    if (!obj) return new NextResponse("not found", { status: 404 });
    return new NextResponse(obj.body, {
      headers: {
        "Content-Type": obj.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("email-asset proxy error", key, err);
    return new NextResponse("not found", { status: 404 });
  }
}
