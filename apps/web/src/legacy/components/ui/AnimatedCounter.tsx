"use client";

import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({
  value,
  format = "number",
}: {
  value: number;
  format?: "number" | "compact";
}) {
  const [display, setDisplay] = useState("...");
  const prev = useRef(0);

  useEffect(() => {
    if (value === 0 && prev.current === 0) return;

    const start = prev.current;
    const end = value;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);

      if (format === "compact") {
        setDisplay(
          Intl.NumberFormat("en-US", {
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(current)
        );
      } else {
        setDisplay(current.toLocaleString());
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
    prev.current = value;
  }, [value, format]);

  return <>{display}</>;
}
