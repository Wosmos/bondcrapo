/**
 * ESLint rule `bondcheck/logical-properties`: forbids physical direction Tailwind utilities in
 * any string or template literal, so every layout mirrors correctly in Urdu (RTL). ADR 0005 and
 * PLAN section 8. Use the logical utility suggested in the message instead.
 */

/** Physical utility (without variants or `!`/`-` prefixes) mapped to its logical replacement. */
const REPLACEMENTS = [
  [/^m([lr])-/, (m) => (m[1] === "l" ? "ms-" : "me-")],
  [/^p([lr])-/, (m) => (m[1] === "l" ? "ps-" : "pe-")],
  [/^scroll-m([lr])-/, (m) => (m[1] === "l" ? "scroll-ms-" : "scroll-me-")],
  [/^scroll-p([lr])-/, (m) => (m[1] === "l" ? "scroll-ps-" : "scroll-pe-")],
  [/^(left|right)-/, (m) => (m[1] === "left" ? "start-" : "end-")],
  [/^text-(left|right)$/, (m) => (m[1] === "left" ? "text-start" : "text-end")],
  [/^float-(left|right)$/, (m) => (m[1] === "left" ? "float-start" : "float-end")],
  [/^clear-(left|right)$/, (m) => (m[1] === "left" ? "clear-start" : "clear-end")],
  [/^border-([lr])(-|$)/, (m) => (m[1] === "l" ? "border-s" : "border-e")],
  [/^rounded-([lr])(-|$)/, (m) => (m[1] === "l" ? "rounded-s" : "rounded-e")],
  [/^rounded-(tl|tr|bl|br)(-|$)/, (m) => ({ tl: "rounded-ss", tr: "rounded-se", bl: "rounded-es", br: "rounded-ee" })[m[1]]],
];

/**
 * For spacing and inset utilities the part after the prefix must look like a Tailwind value
 * (`4`, `0.5`, `px`, `auto`, `1/2`, `[3px]`, `(--x)`), so prose such as "left-aligned" passes.
 */
const VALUE = /^(?:\d+(?:\.\d+)?|px|auto|full|\d+\/\d+|\[[^\]\s]+\]|\([^)\s]+\))$/;

/**
 * Returns `{ token, suggestion }` for the first physical utility in a class string, or null.
 * Exported for unit tests.
 */
export function findPhysicalUtility(text) {
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    // Strip variants (`md:`, `hover:`, `[&>*]:`), the important flag and negative prefix.
    const token = raw.slice(raw.lastIndexOf(":") + 1).replace(/^!/, "").replace(/^-/, "");
    for (const [re, fix] of REPLACEMENTS) {
      const m = re.exec(token);
      if (!m) continue;
      const rest = token.slice(m[0].length);
      if (m[0].endsWith("-") && !/^(border|rounded)/.test(token) && !VALUE.test(rest)) continue;
      return { token: raw, suggestion: fix(m) };
    }
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: { description: "Use logical Tailwind utilities (ms-, pe-, start-, text-end) so RTL works." },
    schema: [],
    messages: {
      physical: "'{{token}}' is a physical direction utility and breaks RTL; use '{{suggestion}}...' instead.",
    },
  },
  create(context) {
    const check = (node, text) => {
      if (typeof text !== "string" || text.length > 2000) return;
      const hit = findPhysicalUtility(text);
      if (hit) context.report({ node, messageId: "physical", data: hit });
    };
    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

export const logicalPropertiesPlugin = {
  meta: { name: "bondcheck" },
  rules: { "logical-properties": rule },
};

export default logicalPropertiesPlugin;
