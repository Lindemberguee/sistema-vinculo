import type { MetadataRoute } from "next";

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_BASE_DOMAIN;
  if (!configured) return undefined;
  return configured.startsWith("http") ? configured : `https://${configured}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];

  return [
    {
      url: origin.replace(/\/$/, ""),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
