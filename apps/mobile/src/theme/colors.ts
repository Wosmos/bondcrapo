/**
 * Colour tokens. Text on surface pairs meet WCAG 2.2 AA (4.5:1 for text, 3:1 for UI);
 * the values were checked with the contrast test in src/theme/__tests__/contrast.test.ts.
 */
export interface Palette {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  danger: string;
  dangerContainer: string;
  info: string;
  infoContainer: string;
  gold: string;
  goldContainer: string;
  focus: string;
  ripple: string;
  scrim: string;
}

export const light: Palette = {
  background: "#F4F7F5",
  surface: "#FFFFFF",
  surfaceMuted: "#EAF0EC",
  border: "#C9D4CD",
  text: "#0F1B15",
  textMuted: "#4A5B52",
  primary: "#0B6B4B",
  onPrimary: "#FFFFFF",
  primaryContainer: "#CDEBDD",
  onPrimaryContainer: "#06351F",
  success: "#0A6B3D",
  successContainer: "#D3F0DF",
  warning: "#7A4B00",
  warningContainer: "#FCE8C3",
  danger: "#A11B1B",
  dangerContainer: "#FBDADA",
  info: "#0B4F8A",
  infoContainer: "#D7E8F8",
  gold: "#7A5A00",
  goldContainer: "#F8EBC4",
  focus: "#0B6B4B",
  ripple: "rgba(11,107,75,0.14)",
  scrim: "rgba(0,0,0,0.45)",
};

export const dark: Palette = {
  background: "#0D1512",
  surface: "#16201B",
  surfaceMuted: "#1E2A24",
  border: "#33443B",
  text: "#E8F0EB",
  textMuted: "#A9BAB0",
  primary: "#5FD3A3",
  onPrimary: "#00281A",
  primaryContainer: "#0F4A34",
  onPrimaryContainer: "#C6F1DC",
  success: "#6FDCA0",
  successContainer: "#123D27",
  warning: "#F2C46B",
  warningContainer: "#3F2E0A",
  danger: "#FF9C94",
  dangerContainer: "#4A1515",
  info: "#8EC3F5",
  infoContainer: "#122E48",
  gold: "#E9C766",
  goldContainer: "#3A2F0E",
  focus: "#5FD3A3",
  ripple: "rgba(95,211,163,0.18)",
  scrim: "rgba(0,0,0,0.6)",
};

/** WCAG relative luminance contrast ratio between two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const channels = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
