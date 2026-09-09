/**
 * Sanitise a user-supplied `callbackUrl` / `next` before handing it to
 * `window.location.assign` or a redirect. NextAuth only sanitises the value
 * when it drives the redirect itself; with `redirect: false` the raw query
 * param would otherwise reach the browser and allow an open redirect
 * (`?callbackUrl=https://evil.example`).
 *
 * Only a root-relative path on the current origin is allowed; anything else
 * falls back to `fallback`.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) return fallback;
  // Reject protocol-relative (`//host`), scheme URLs (`https:`, `javascript:`),
  // and backslash tricks browsers normalise to `//`.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  try {
    // Resolve against a throwaway origin; if it "escapes" to another origin the
    // input wasn't actually relative.
    const url = new URL(raw, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
