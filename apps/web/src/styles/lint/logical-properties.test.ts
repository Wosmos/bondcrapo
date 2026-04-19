import { ESLint, Linter } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import plugin, { findPhysicalUtility } from "./logical-properties.mjs";

const linter = new Linter({ configType: "flat" });
const config: Linter.Config[] = [
  {
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { bondcheck: plugin },
    rules: { "bondcheck/logical-properties": "error" },
  },
];
const lint = (code: string) => linter.verify(code, config, "planted.jsx");

describe("logical-properties rule", () => {
  it("catches a planted ml-4 in a className", () => {
    const messages = lint(`export const A = () => <div className="flex ml-4 gap-2" />;`);
    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBe("bondcheck/logical-properties");
    expect(messages[0].message).toContain("ml-4");
    expect(messages[0].message).toContain("ms-");
  });

  it("catches utilities in template literals, class maps and with variants", () => {
    expect(lint("const c = `p-2 ${x} md:pr-6`;")).toHaveLength(1);
    expect(lint(`const MAP = { a: "hover:text-right" };`)).toHaveLength(1);
    expect(lint(`const s = "absolute -left-2 top-0";`)).toHaveLength(1);
    expect(lint(`const s = "rounded-l-lg";`)).toHaveLength(1);
    expect(lint(`const s = "border-r border-line";`)).toHaveLength(1);
  });

  it("accepts logical utilities and ordinary prose", () => {
    expect(lint(`const s = "ms-4 pe-2 start-0 end-1 text-start text-end rounded-s-lg border-e";`)).toEqual([]);
    expect(lint(`const s = "Keep the text left-aligned on the right side";`)).toEqual([]);
    expect(lint(`const s = "border-left: 1px; margin-right: auto";`)).toEqual([]);
  });

  it("suggests the logical replacement", () => {
    expect(findPhysicalUtility("pl-3")).toEqual({ token: "pl-3", suggestion: "ps-" });
    expect(findPhysicalUtility("sm:right-[3px]")).toEqual({ token: "sm:right-[3px]", suggestion: "end-" });
    expect(findPhysicalUtility("text-left")).toEqual({ token: "text-left", suggestion: "text-start" });
    expect(findPhysicalUtility("rounded-tr-xl")).toEqual({ token: "rounded-tr-xl", suggestion: "rounded-se" });
    expect(findPhysicalUtility("mx-auto px-4")).toBeNull();
  });

  it("is wired into the web app ESLint config", async () => {
    const cwd = fileURLToPath(new URL("../../..", import.meta.url));
    const eslint = new ESLint({ cwd });
    const [result] = await eslint.lintText(`export const A = () => <div className="ml-4" />;\n`, {
      filePath: "src/components/Planted.tsx",
    });
    expect(result.messages.map((m) => m.ruleId)).toContain("bondcheck/logical-properties");
  });
});
