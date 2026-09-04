import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based tenant routing.
 *
 *   app.<base>     → /panel/*   (dashboard; auth guards inside)
 *   admin.<base>   → /admin/*   (platform back-office)
 *   <slug>.<base>  → /sites/<host>/*   (public campaign pages)
 *   custom domain  → /sites/<host>/*
 *
 * DB lookups are NOT done here (Edge). The rewrite carries the raw host in a
 * header; RSC loaders under /sites resolve it via resolveTenant().
 *
 * NOTE: the folder must NOT be `_sites` — an underscore-prefixed folder is a
 * Next.js "private folder" and is excluded from routing, which 404s every
 * public page.
 */
const BASE_DOMAIN = (process.env.APP_BASE_DOMAIN ?? "localhost:3000").toLowerCase();

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)"],
};

export function middleware(req: NextRequest) {
  const rawHost = (req.headers.get("host") ?? "").toLowerCase();
  const host = rawHost.split(":")[0]!;
  const base = BASE_DOMAIN.split(":")[0]!;
  const url = req.nextUrl.clone();

  // The bare/base domain is the public marketing surface at `/`. Keep the
  // panel on the app subdomain, while preserving the existing local-dev
  // convenience where every non-root path on localhost maps to `/panel`.
  const isPanel = host === `app.${base}` || (host === base && url.pathname !== "/");
  const isAdmin = host === `admin.${base}`;

  // Keep the root of the base domain on the marketing home. Every other
  // surface continues through the host-based rewrites below.
  if (host === base && url.pathname === "/") {
    return NextResponse.next();
  }

  if (isAdmin) {
    url.pathname = `/admin${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isPanel) {
    url.pathname = `/panel${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Public tenant site (subdomain or custom domain).
  url.pathname = `/sites/${rawHost}${url.pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set("x-tenant-host", rawHost);
  return res;
}
