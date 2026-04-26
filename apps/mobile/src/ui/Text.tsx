import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme";
import type { Palette } from "@/theme/colors";

export type TextVariant = "display" | "title" | "heading" | "body" | "label" | "caption";

const SIZES: Record<TextVariant, { size: number; bold: boolean }> = {
  display: { size: 30, bold: true },
  title: { size: 22, bold: true },
  heading: { size: 18, bold: true },
  body: { size: 16, bold: false },
  label: { size: 14, bold: true },
  caption: { size: 13, bold: false },
};

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: keyof Pick<Palette, "text" | "textMuted" | "primary" | "danger" | "success" | "warning" | "info" | "gold" | "onPrimary" | "onPrimaryContainer">;
  align?: TextStyle["textAlign"];
}

/** Locale aware text: Noto Nastaliq Urdu with tall line height in Urdu, system font in English. */
export function Text({ variant = "body", tone = "text", align, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const { size, bold } = SIZES[variant];
  const family = theme.fontFamily(bold ? "bold" : "regular");
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          color: theme.colors[tone],
          fontSize: size,
          lineHeight: theme.lineHeight(size),
          fontFamily: family,
          fontWeight: family ? undefined : bold ? "700" : "400",
          textAlign: align,
        },
        style,
      ]}
    />
  );
}

/**
 * Numbers (bond numbers, prices, dates in digits) always use Western digits, the system font
 * and left to right order, also inside Urdu sentences.
 */
export function Num({
  variant = "body",
  tone = "text",
  mono = false,
  style,
  ...rest
}: AppTextProps & { mono?: boolean }) {
  const theme = useTheme();
  const { size, bold } = SIZES[variant];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        {
          color: theme.colors[tone],
          fontSize: size,
          lineHeight: Math.round(size * 1.35),
          fontWeight: bold ? "700" : "500",
          fontFamily: mono ? "monospace" : undefined,
          fontVariant: ["tabular-nums"],
          writingDirection: "ltr",
          letterSpacing: mono ? 1 : 0,
        },
        style,
      ]}
    />
  );
}
