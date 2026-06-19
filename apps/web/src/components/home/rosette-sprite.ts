import { ROSETTE } from "./guilloche";

/** Contents of public/brand/rosette.svg, an external sprite so the paths are not inlined in every page. */
export function rosetteSprite(): string {
  const paths = Object.entries(ROSETTE)
    .map(([id, d]) => `<path id="${id}" d="${d}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>${paths}</defs></svg>\n`;
}
