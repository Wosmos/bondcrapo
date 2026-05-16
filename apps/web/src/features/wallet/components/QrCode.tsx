"use client";

import { useEffect, useState } from "react";

/**
 * QR code as an inline SVG path (crisp at any size, prints well, no canvas). The encoder is
 * loaded only when a code is shown, so it never weighs on the first page load.
 */
export function QrCode({ value, label, size = 192 }: { value: string; label: string; size?: number }) {
  const [path, setPath] = useState<{ d: string; n: number } | null>(null);

  useEffect(() => {
    let alive = true;
    import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      let d = "";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
      if (alive) setPath({ d, n });
    });
    return () => {
      alive = false;
    };
  }, [value]);

  const quiet = 4;
  return (
    <div className="inline-block rounded-lg border border-slate-200 bg-white p-2" style={{ width: size + 18, height: size + 18 }}>
      {path ? (
        <svg
          role="img"
          aria-label={label}
          width={size}
          height={size}
          viewBox={`${-quiet} ${-quiet} ${path.n + quiet * 2} ${path.n + quiet * 2}`}
          shapeRendering="crispEdges"
        >
          <rect x={-quiet} y={-quiet} width={path.n + quiet * 2} height={path.n + quiet * 2} fill="#fff" />
          <path d={path.d} fill="#0f172a" />
        </svg>
      ) : (
        <div role="status" aria-label={label} className="size-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      )}
    </div>
  );
}
