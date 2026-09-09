"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/components/ui";

/**
 * Scrollable tab strip for the campaign editor. Scrolls the active tab into
 * view on load, and fades the trailing edge so it's clear the row scrolls.
 */
export function CampaignTabNav({
  tabs,
  current,
}: {
  tabs: readonly { key: string; label: string; href: string }[];
  current: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);

  return (
    <nav
      ref={ref}
      aria-label="Configurações da campanha"
      className="mb-5 flex gap-1 overflow-x-auto border-b border-line pb-px [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            t.key === current
              ? "border-brand-600 text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
