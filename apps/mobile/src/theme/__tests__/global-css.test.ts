import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dark, light, type Palette } from "../colors";

/** The NativeWind variables in src/global.css must equal the contrast-checked palette. */
const css = readFileSync(join(__dirname, "..", "..", "global.css"), "utf8");

function variables(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([\d ]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");
const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

describe.each([
  [":root", light],
  [".dark:root", dark],
] as [string, Palette][])("global.css %s", (selector, palette) => {
  const vars = variables(selector);
  const hexKeys = (Object.keys(palette) as (keyof Palette)[]).filter((k) => palette[k].startsWith("#"));

  it.each(hexKeys)("--%s matches the palette", (key) => {
    expect(vars[kebab(key)]).toBe(channels(palette[key]));
  });

  it("defines no colour the palette lacks", () => {
    expect(Object.keys(vars).sort()).toEqual(hexKeys.map(kebab).sort());
  });
});
