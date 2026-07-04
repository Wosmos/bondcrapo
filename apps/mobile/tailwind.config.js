/**
 * NativeWind (Tailwind 3) theme for the app. Every colour reads a variable from src/global.css,
 * which mirrors src/theme/colors.ts, so light and dark mode and the contrast checks stay in one
 * place. The React Native Reusables names (primary, muted, card, ...) map onto the same palette.
 */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // App palette (src/theme/colors.ts)
        surface: { DEFAULT: c("surface"), muted: c("surface-muted") },
        text: { DEFAULT: c("text"), muted: c("text-muted") },
        success: { DEFAULT: c("success"), container: c("success-container") },
        warning: { DEFAULT: c("warning"), container: c("warning-container") },
        danger: { DEFAULT: c("danger"), container: c("danger-container") },
        info: { DEFAULT: c("info"), container: c("info-container") },
        gold: { DEFAULT: c("gold"), container: c("gold-container") },
        focus: c("focus"),

        // React Native Reusables (shadcn) names
        background: c("background"),
        foreground: c("text"),
        border: c("border"),
        input: c("border"),
        ring: c("focus"),
        primary: { DEFAULT: c("primary"), foreground: c("on-primary"), container: c("primary-container"), "on-container": c("on-primary-container") },
        secondary: { DEFAULT: c("surface-muted"), foreground: c("text") },
        muted: { DEFAULT: c("surface-muted"), foreground: c("text-muted") },
        accent: { DEFAULT: c("primary-container"), foreground: c("on-primary-container") },
        destructive: { DEFAULT: c("danger"), foreground: c("danger-container") },
        card: { DEFAULT: c("surface"), foreground: c("text") },
        popover: { DEFAULT: c("surface"), foreground: c("text") },
      },
      // Same radii as theme.radius (sm 8, md 12, lg 20).
      borderRadius: { sm: "8px", md: "12px", lg: "20px" },
      fontFamily: {
        urdu: ["NotoNastaliqUrdu_400Regular"],
        "urdu-bold": ["NotoNastaliqUrdu_700Bold"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
