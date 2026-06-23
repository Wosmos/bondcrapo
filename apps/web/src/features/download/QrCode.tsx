import { encodeQr, qrPath } from "./qr";

/** Server rendered QR code (SVG). Always paired with the URL as text for people who cannot scan. */
export function QrCode({ value, label, size = 176 }: { value: string; label: string; size?: number }) {
  const qr = encodeQr(value);
  const dim = qr.size + 8;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={qrPath(qr)} fill="#0f172a" />
    </svg>
  );
}
