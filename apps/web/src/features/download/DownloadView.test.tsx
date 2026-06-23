import { createTranslator } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import enMessages from "../../../messages/en/download.json";
import urMessages from "../../../messages/ur/download.json";
import { DownloadView, type DownloadState } from "./DownloadView";
import { RELEASE_JSON, SUMS_TEXT } from "./__fixtures__/github";
import { buildManifest, parseChecksums, publicDownloads } from "./release-assets";

const sums = parseChecksums(SUMS_TEXT);
const assets = RELEASE_JSON.assets.map((a: { id: number; name: string; size: number }) => ({ id: a.id, name: a.name, size: a.size }));
const fixture: DownloadState = {
  status: "ok",
  version: "1.2.0",
  publishedAt: RELEASE_JSON.published_at,
  notes: RELEASE_JSON.body,
  downloads: publicDownloads(assets, sums),
  manifest: buildManifest({ version: "1.2.0", publishedAt: RELEASE_JSON.published_at, notes: "", assets, sums, manifestText: null }),
};

function render(state: DownloadState, locale: "en" | "ur" = "en", pageUrl: string | null = "https://bondcheck.test/en/download") {
  const t = createTranslator({ locale, messages: { download: locale === "en" ? enMessages : urMessages }, namespace: "download" });
  return renderToStaticMarkup(
    <DownloadView state={state} locale={locale} pageUrl={pageUrl} t={(key, values) => t(key as never, values as never)} />,
  );
}

describe("/download view", () => {
  it("renders version, size, checksum, steps and a QR code from a fixture manifest", () => {
    const html = render(fixture);
    expect(html).toContain("<h1");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="/api/v1/releases/download/bondcheck-1.2.0.apk"');
    expect(html).toContain("v1.2.0");
    expect(html).toContain("30.0 MB");
    expect(html).toContain("10 June 2026");
    expect(html).toContain(sums["bondcheck-1.2.0.apk"]);
    expect(html).toContain("Android 7.0 or newer");
    expect(html).toContain("<ol");
    expect(html).toContain('role="img" aria-label="QR code linking to https://bondcheck.test/en/download"');
    expect(html).not.toMatch(/github\.com|api\.github/);
  });

  it("explains the state instead of failing when downloads are not configured", () => {
    const html = render({ status: "unavailable", reason: "unconfigured" });
    expect(html).toContain("Downloads are being set up");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("/api/v1/releases/download/");
  });

  it("shows the not released yet message and hides the QR code without a site URL", () => {
    const html = render({ status: "none" }, "en", null);
    expect(html).toContain("has not been released yet");
    expect(html).not.toContain("QR code");
  });

  it("renders in Urdu with the bond app wording and Western digits", () => {
    const html = render(fixture, "ur");
    expect(html).toContain("اینڈرائیڈ کے لیے ڈاؤن لوڈ کریں");
    expect(html).toContain('<bdi dir="ltr">v1.2.0</bdi>');
    expect(html).toMatch(/10 جون،? 2026/);
  });
});

describe("download messages", () => {
  const keys = (o: Record<string, unknown>, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

  it("has the same keys in English and Urdu and no em dashes", () => {
    expect(keys(urMessages).sort()).toEqual(keys(enMessages).sort());
    expect(JSON.stringify([enMessages, urMessages])).not.toContain("\u2014");
  });
});
