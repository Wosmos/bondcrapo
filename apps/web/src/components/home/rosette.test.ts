import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { rosetteSprite } from "./rosette-sprite";

it("public/brand/rosette.svg matches the guilloche generator", () => {
  const file = readFileSync(new URL("../../../public/brand/rosette.svg", import.meta.url), "utf8");
  // After changing guilloche.ts, write rosetteSprite() to public/brand/rosette.svg.
  expect(file).toBe(rosetteSprite());
});
