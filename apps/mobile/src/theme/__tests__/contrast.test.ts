import { contrastRatio, dark, light, type Palette } from "../colors";

const TEXT_PAIRS: [keyof Palette, keyof Palette][] = [
  ["text", "background"],
  ["text", "surface"],
  ["textMuted", "surface"],
  ["textMuted", "background"],
  ["textMuted", "surfaceMuted"],
  ["primary", "surface"],
  ["onPrimary", "primary"],
  ["onPrimaryContainer", "primaryContainer"],
  ["success", "successContainer"],
  ["success", "surface"],
  ["warning", "warningContainer"],
  ["danger", "dangerContainer"],
  ["danger", "surface"],
  ["info", "infoContainer"],
  ["gold", "goldContainer"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s palette", (_name, palette) => {
  it.each(TEXT_PAIRS)("%s on %s meets 4.5:1", (fg, bg) => {
    expect(contrastRatio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("input borders reach 3:1 against the surface", () => {
    expect(contrastRatio(palette.textMuted, palette.surface)).toBeGreaterThanOrEqual(3);
  });
});
