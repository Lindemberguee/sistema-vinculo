/**
 * Allowlist for the `embed` block. Only known providers get an <iframe>; anything
 * else is rejected so tenants can't drop arbitrary/hostile pages onto their
 * public site. Pure + isomorphic (used by the server renderer and the canvas).
 */

export interface EmbedResult {
  ok: boolean;
  src?: string;
  provider?: string;
}

/** Providers we support, in priority order. */
export const EMBED_PROVIDERS = [
  "YouTube",
  "Vimeo",
  "Google Forms",
  "Google Agenda",
  "Google Maps (link “Incorporar”)",
  "Typeform",
  "Spotify",
  "SoundCloud",
] as const;

const RULES: { host: RegExp; provider: string; to: (u: URL) => string | null }[] = [
  {
    host: /^(www\.)?youtube\.com$/,
    provider: "YouTube",
    to: (u) => {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.slice(7) : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    },
  },
  {
    host: /^youtu\.be$/,
    provider: "YouTube",
    to: (u) => {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    },
  },
  { host: /^player\.vimeo\.com$/, provider: "Vimeo", to: (u) => u.href },
  {
    host: /^(www\.)?vimeo\.com$/,
    provider: "Vimeo",
    to: (u) => {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return /^\d+$/.test(id ?? "") ? `https://player.vimeo.com/video/${id}` : null;
    },
  },
  {
    host: /^docs\.google\.com$/,
    provider: "Google Forms",
    to: (u) => {
      if (!u.pathname.includes("/forms/")) return null;
      u.searchParams.set("embedded", "true");
      return u.href;
    },
  },
  {
    host: /^calendar\.google\.com$/,
    provider: "Google Agenda",
    to: (u) => (u.pathname.includes("/calendar/embed") || u.searchParams.has("src") ? u.href : null),
  },
  {
    // Only the ready-made "Incorporar um mapa" URL, which is /maps/embed?pb=...
    host: /^(www\.)?google\.[a-z.]+$/,
    provider: "Google Maps",
    to: (u) => (u.pathname.startsWith("/maps/embed") ? u.href : null),
  },
  { host: /(^|\.)typeform\.com$/, provider: "Typeform", to: (u) => u.href },
  {
    host: /^open\.spotify\.com$/,
    provider: "Spotify",
    to: (u) => `https://open.spotify.com/embed${u.pathname}`,
  },
  {
    host: /(^|\.)soundcloud\.com$/,
    provider: "SoundCloud",
    to: (u) =>
      u.hostname === "w.soundcloud.com"
        ? u.href
        : `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&color=%23006b4f`,
  },
];

export function resolveEmbed(raw: string): EmbedResult {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false };
  }
  if (u.protocol !== "https:") return { ok: false };

  for (const rule of RULES) {
    if (!rule.host.test(u.hostname)) continue;
    const src = rule.to(u);
    if (src) return { ok: true, src, provider: rule.provider };
    return { ok: false, provider: rule.provider };
  }
  return { ok: false };
}
