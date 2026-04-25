"use client";

import { useEffect, useRef, useState } from "react";

const LOCALE_MAP: Record<string, string> = {
  en: "en-PK", ur: "ur-PK", pa: "pa-Arab-PK", sd: "sd-Arab-PK",
};

export function AnimatedCounter({
  value,
  format = "number",
  locale = "en",
}: {
  value: number;
  format?: "number" | "compact";
  locale?: string;
}) {
  const [display, setDisplay] = useState("...");
  const prev = useRef(0);

  useEffect(() => {
    if (value === 0 && prev.current === 0) return;

    const start = prev.current;
    const end = value;
    const duration = 1000;
    const startTime = performance.now();
    const loc = LOCALE_MAP[locale] ?? "en-PK";

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);

      if (format === "compact") {
        setDisplay(
          new Intl.NumberFormat(loc, {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(current)
        );
      } else {
        setDisplay(new Intl.NumberFormat(loc).format(current));
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prev.current = value;
  }, [value, format, locale]);

  return <>{display}</>;
}
