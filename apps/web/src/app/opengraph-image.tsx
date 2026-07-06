import { ImageResponse } from "next/og";
import { ROSETTE } from "@/components/home/guilloche";

export const alt = "BondCheck: prize bond results, gold and rupee rates for Pakistan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Shared Open Graph card, rendered once at build time. Text is Latin only: the image renderer
 * cannot shape Nastaliq, so Urdu pages reuse this card and carry Urdu titles in their metadata.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f7f8",
          color: "#18181b",
          padding: 72,
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <svg
          width="620"
          height="620"
          viewBox="0 0 200 200"
          style={{ position: "absolute", right: -120, top: -60 }}
          fill="none"
          stroke="#4338ca"
          strokeOpacity="0.35"
          strokeWidth="0.5"
        >
          <path d={ROSETTE.outer} />
          <path d={ROSETTE.inner} stroke="#b88a1b" />
          <path d={ROSETTE.core} />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: "#4338ca",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
                <path
                  d="M7 10.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.3a3.2 3.2 0 0 0 0 6.4v2.3a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2.3a3.2 3.2 0 0 0 0-6.4z"
                  stroke="#fff"
                  strokeWidth="1.7"
                />
                <path d="m12.6 16.1 2.4 2.4 4.6-4.9" stroke="#e2b553" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 44, fontWeight: 700 }}>BondCheck</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Every draw.</div>
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Every bond.</div>
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#4338ca" }}>
              One check.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#44554c" }}>
            Prize bond results back to 2000 · Gold and rupee rates · English and Urdu
          </div>
        </div>
      </div>
    ),
    size,
  );
}
