"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Client island for the `impactCounters` block's `animate` toggle (identidade-visual
 * §9.3): counts up from 0 to `value` once the element enters the viewport. Renders
 * the final value immediately (no animation) under prefers-reduced-motion, and on
 * first paint before JS/IntersectionObserver kick in — so it never flashes "0" for
 * users who don't get the animation.
 */
export function CountUpNumber({
  value,
  suffix = "",
  className,
  style,
}: {
  value: number;
  suffix?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setDisplay(0);
    let raf = 0;
    const duration = 900;

    const tick = (start: number) => (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick(start));
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        raf = requestAnimationFrame(tick(performance.now()));
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <div ref={ref} className={className} style={style}>
      {display.toLocaleString("pt-BR")}
      {suffix}
    </div>
  );
}
