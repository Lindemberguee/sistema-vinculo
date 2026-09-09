import { isIP } from "node:net";

/**
 * True when an IP literal points at loopback, link-local, or an RFC-1918 /
 * unique-local range — i.e. somewhere a public webhook should never reach.
 * Unknown / unparseable input is treated as private (fail closed).
 */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    if (a === undefined || b === undefined) return true;
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd")
    );
  }
  return true;
}

/** Resolve `hostname` (A + AAAA) and report whether any record is private. */
export async function hostResolvesPrivate(hostname: string): Promise<boolean> {
  const { lookup } = await import("node:dns/promises");
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  return resolved.length === 0 || resolved.some(({ address }) => isPrivateAddress(address));
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Validate a URL the server itself will call out to (outbound webhooks, probes).
 * Rejects non-https (except http on localhost when `allowLocalhost`), embedded
 * credentials, non-standard ports, and any hostname that resolves into a
 * private/loopback range (basic SSRF / DNS-rebinding guard).
 *
 * Throws {@link UnsafeUrlError} with a user-facing message on rejection;
 * returns the parsed `URL` when it's safe.
 */
export async function assertSafeOutboundUrl(
  raw: string,
  opts: { allowLocalhost?: boolean } = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL inválida.");
  }

  const host = url.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
  const allowLocal = Boolean(opts.allowLocalhost) && isLocal;

  if (url.protocol !== "https:" && !(url.protocol === "http:" && allowLocal)) {
    throw new UnsafeUrlError("Use uma URL https://.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("A URL não pode conter usuário ou senha.");
  }
  if (url.port && !["", "80", "443"].includes(url.port)) {
    throw new UnsafeUrlError("Porta não permitida (use 80 ou 443).");
  }
  if (allowLocal) return url;
  if (isLocal || (await hostResolvesPrivate(host))) {
    throw new UnsafeUrlError("O host resolve para uma rede privada e não é permitido.");
  }
  return url;
}
