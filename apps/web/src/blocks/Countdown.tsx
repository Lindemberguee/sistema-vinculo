"use client";

import { useEffect, useState } from "react";

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export function Countdown({
  title,
  deadline,
  endedLabel,
  accent,
}: {
  title: string;
  deadline: string;
  endedLabel: string;
  accent: string;
}) {
  const target = deadline ? new Date(deadline).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!Number.isFinite(target)) {
    return (
      <div className="mx-auto max-w-lg px-6 py-8">
        <div className="grid h-24 place-items-center rounded-xl border border-dashed border-line-strong text-sm text-faint">
          Defina a data de encerramento
        </div>
      </div>
    );
  }

  const left = target - now;
  const ended = left <= 0;
  const p = parts(left);
  const cells: [number, string][] = [
    [p.d, "dias"],
    [p.h, "horas"],
    [p.m, "min"],
    [p.s, "seg"],
  ];

  return (
    <div className="mx-auto max-w-lg px-6 py-10 text-center">
      <div className="text-sm font-medium text-muted">{ended ? endedLabel : title}</div>
      {!ended && (
        <div className="mt-3 flex justify-center gap-2.5">
          {cells.map(([v, label]) => (
            <div key={label} className="min-w-[64px] rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="text-2xl font-semibold tabular-nums" style={{ color: accent }}>
                {String(v).padStart(2, "0")}
              </div>
              <div className="text-[0.625rem] uppercase tracking-wide text-faint">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
