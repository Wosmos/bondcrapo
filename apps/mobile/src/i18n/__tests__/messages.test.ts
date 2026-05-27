import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { messageKeys, RAW_MESSAGES, translate } from "../translate";

describe("messages", () => {
  it("has the same keys in English and Urdu", () => {
    const en = messageKeys(RAW_MESSAGES.en).sort();
    const ur = messageKeys(RAW_MESSAGES.ur).sort();
    expect(ur).toEqual(en);
  });

  it("covers every key the source code asks for", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== "__tests__") walk(full);
        } else if (/\.tsx?$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const keys = new Set(messageKeys(RAW_MESSAGES.en));
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
        const key = m[1]!;
        if (key.startsWith("common.")) continue;
        if (!keys.has(key) && !keys.has(`${key}_one`)) missing.push(`${path.relative(root, file)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("never uses an em dash", () => {
    for (const locale of ["en", "ur"] as const) {
      expect(JSON.stringify(RAW_MESSAGES[locale])).not.toContain("\u2014");
    }
  });

  it("interpolates values, picks plural forms and falls back to English", () => {
    expect(translate("en", "home.inDays", { count: 1 })).toBe("In 1 day");
    expect(translate("en", "home.inDays", { count: 3 })).toBe("In 3 days");
    expect(translate("ur", "denomination.bearer", { value: "750" })).toBe("750 روپے");
    expect(translate("ur", "common.appName")).not.toBe("common.appName");
    expect(translate("en", "no.such.key")).toBe("no.such.key");
  });

  it("keeps the copies of the website namespaces in sync", () => {
    expect(() =>
      execFileSync(process.execPath, [path.resolve(__dirname, "../../../scripts/sync-messages.mjs"), "--check"], { stdio: "pipe" }),
    ).not.toThrow();
  });
});
