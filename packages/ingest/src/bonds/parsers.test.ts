import { describe, expect, it } from "vitest";
import { parseLooseDate } from "./dates";
import { fixtureBytes, fixtureText } from "./fixtures";
import {
  parseOfficialDateList,
  parseOfficialListing,
  parseOfficialSpot,
  parsePrizeinfoRecord,
  parsePrizeinfoSchedule,
} from "./parse-html";
import { parseResultText } from "./parse-result-text";
import { extractPdfText } from "./pdf";

const file = (name: string) => parseResultText(fixtureText(`savings_gov_pk/files/${name}`));
const counts = (r: ReturnType<typeof parseResultText>) => [1, 2, 3].map((t) => r.tiers[t as 1 | 2 | 3].numbers.length);

describe("parseLooseDate", () => {
  it("reads every spelling found in the sources, day first", () => {
    expect(parseLooseDate("15-Oct-2002")).toBe("2002-10-15");
    expect(parseLooseDate("1 August 2017")).toBe("2017-08-01");
    expect(parseLooseDate("15/01/2019")).toBe("2019-01-15");
    expect(parseLooseDate("17.02.2025")).toBe("2025-02-17");
    expect(parseLooseDate("15 October, 2026 ")).toBe("2026-10-15");
    expect(parseLooseDate("15th December, 2023")).toBe("2023-12-15");
    expect(parseLooseDate("February 15, 2024")).toBe("2024-02-15");
    expect(parseLooseDate("31-02-2024")).toBeNull();
  });
});

describe("official TXT result files", () => {
  it("Rs 750, 2019 layout: header fields, prize table and 1 + 3 + 1696 numbers", () => {
    const r = file("2024_11_15-01-2019-Rs-750.txt");
    expect(r.header).toEqual({ faceValue: 750, premium: false, drawNumber: 77, drawDate: "2019-01-15", city: "Peshawar" });
    expect(counts(r)).toEqual([1, 3, 1696]);
    expect(r.tiers[1].numbers).toEqual([479780]);
    expect(r.tiers[2].numbers).toEqual([121611, 223172, 553151]);
    expect(r.tiers[3].header).toEqual({ amountPkr: 9300, count: 1696 });
    expect(r.tiers[1].header.amountPkr).toBe(1_500_000);
  });

  it("Rs 200 has five second prizes; a heading that prints the total of all tiers is read as such", () => {
    const r = file("2026_09_200_150926.txt");
    expect(counts(r)).toEqual([1, 5, 2394]);
    expect(r.tiers[2].numbers).toEqual([381066, 425087, 796229, 799273, 844138]);
    expect(r.header).toMatchObject({ drawNumber: 107, drawDate: "2026-09-15", city: "Muzaffarabad" });
    expect(r.tiers[3].header.count).toBe(2394);
    expect(r.warnings[0]).toMatch(/2400/);
  });

  it("Premium 25000 has two first prizes of Rs 30 million and 700 third prizes", () => {
    const r = file("2026_09_25000_100926-1.txt");
    expect(r.header).toMatchObject({ faceValue: 25000, premium: true, drawNumber: 23, drawDate: "2026-09-10", city: "Quetta" });
    expect(counts(r)).toEqual([2, 5, 700]);
    expect(r.tiers[1].numbers).toEqual([151975, 154149]);
    expect(r.tiers[1].header).toEqual({ amountPkr: 30_000_000, count: 2 });
    expect(r.tiers[3].header.amountPkr).toBe(300_000);
  });

  it("Premium 40000 (2019): spreadsheet padding 000000 is not a bond number", () => {
    const r = file("2024_11_11-03-2019-Rs-40000-premium.txt");
    expect(counts(r)).toEqual([1, 3, 660]);
    expect(r.tiers[3].numbers).not.toContain(0);
    expect(r.header).toMatchObject({ drawNumber: 8, drawDate: "2019-03-11", city: "Rawalpindi" });
  });

  it("ignores the preamble: series counts, notification numbers and the 000001 to 999999 range", () => {
    const r = file("2024_11_Complete-200-list-15-3-2024.txt");
    expect(counts(r)).toEqual([1, 5, 2394]);
    expect(r.tiers[3].numbers).not.toContain(1);
    expect(r.tiers[3].numbers).not.toContain(999_999);
    expect(r.tiers[1].numbers).toEqual([612132]);
    expect(r.tiers[3].header.amountPkr).toBe(1250);
  });

  it("reads amounts written with a space after the thousands comma and old CR line endings", () => {
    expect(file("2026_05_DRAW-RESULT-OF-RS.1500-DENOMINATIO.txt").tiers[3].header.amountPkr).toBe(18_500);
    const cr = file("2025_02_Rs.100-49th-Draw-RWP-Final.txt");
    expect(counts(cr)).toEqual([1, 3, 1199]);
    expect(cr.header).toMatchObject({ drawNumber: 49, drawDate: "2025-02-17", city: "Rawalpindi" });
  });

  it("parses every recorded official TXT file into the expected tier sizes", () => {
    const expected: Record<string, number[]> = {
      "100": [1, 3, 1199],
      "200": [1, 5, 2394],
      "750": [1, 3, 1696],
      "1500": [1, 3, 1696],
      "25000": [2, 5, 700],
      "40000": [1, 3, 660],
    };
    for (const name of [
      "2024_11_15-02-2019-Rs-100.txt",
      "2024_11_15-05-2023-Rs-100.txt",
      "2026_08_100_170826.txt",
      "2024_11_15-03-2021-Rs-200-1.txt",
      "2025_03_Prize-200-101-draw-17-March.txt",
      "2026_07_Rs-750-107-draw.txt",
      "2024_11_16-10-2023-Rs-750-1.txt",
      "2024_11_15-02-2019-Rs-1500.txt",
      "2024_11_Draw-List-1500.97-LHR.txt",
      "2024_12_Copy-of-Excel-for-25000-16th-draw-RDNS.txt",
      "2026_03_March-DRAW-RESULT-OF-Rs.25000-DENOMINATI.txt",
      "2024_12_Copy-of-31st-Draw-list-PPB-40K.txt",
      "2026_09_40000_100926.txt",
    ]) {
      const r = file(name);
      expect(counts(r), name).toEqual(expected[String(r.header.faceValue)]);
    }
  });
});

describe("official PDF result files", () => {
  it("extracts the Rs 200 PDF-only draw of 15-12-2023 with its five second prizes", async () => {
    const pdf = await extractPdfText(fixtureBytes("savings_gov_pk/files/2024_11_15-12-2023.pdf"));
    expect(pdf.hasTextLayer).toBe(true);
    const r = parseResultText(pdf.text);
    expect(counts(r)).toEqual([1, 5, 2394]);
    expect(r.tiers[1].numbers).toEqual([985380]);
    expect(r.header).toMatchObject({ faceValue: 200, drawNumber: 96, drawDate: "2023-12-15", city: "Multan" });
    expect(r.tiers[3].header).toEqual({ amountPkr: 1250, count: 2394 });
  });

  it("the Premium 25000 PDF (an OCR text layer) agrees with the TXT and loses four damaged numbers", async () => {
    const pdf = await extractPdfText(
      fixtureBytes("savings_gov_pk/files/2026_03_Draw-Result-21st-Draw-of-Rs.25000-Premium-Prize-Bond-held-on-10-03-2026-at-SBP-BSC-Multan.pdf"),
    );
    const fromPdf = parseResultText(pdf.text);
    const fromTxt = file("2026_03_March-DRAW-RESULT-OF-Rs.25000-DENOMINATI.txt");
    expect(fromPdf.tiers[1].numbers).toEqual(fromTxt.tiers[1].numbers);
    expect(fromPdf.tiers[2].numbers).toEqual(fromTxt.tiers[2].numbers);
    // "46B441" and similar OCR damage is not read as a number, so the list is short (and is
    // rejected by validation), but nothing wrong is invented.
    expect(fromPdf.tiers[3].numbers).toHaveLength(696);
    const txt3 = new Set(fromTxt.tiers[3].numbers);
    expect(fromPdf.tiers[3].numbers.every((n) => txt3.has(n))).toBe(true);
    expect(fromPdf.tiers[3].header).toEqual({ amountPkr: 300_000, count: 700 });
    expect(fromPdf.header).toMatchObject({ drawNumber: 21, drawDate: "2026-03-10", city: "Multan" });
  });

  it("reports a scanned PDF as having no text layer", async () => {
    const pdf = await extractPdfText(
      fixtureBytes("savings_gov_pk/files/2024_11_Draw-List-Rs.-40000-PPB-27th-Draw-Karachi_compressed-1_compressed.pdf"),
    );
    expect(pdf.hasTextLayer).toBe(false);
  });
});

describe("official HTML pages", () => {
  it("lists the result files of a denomination page with their draw dates", () => {
    const links = parseOfficialListing(fixtureText("savings_gov_pk/pages/rs-750-prize-bond-draw.html"));
    expect(links.length).toBeGreaterThanOrEqual(30);
    expect(links).toContainEqual(
      expect.objectContaining({ format: "txt", drawDate: "2026-07-15", url: "https://savings.gov.pk/wp-content/uploads/2026/07/Rs-750-107-draw.txt" }),
    );
    expect(links.find((l) => l.url.endsWith(".pdf"))?.drawDate).toBe("2026-01-15");
    expect(links.find((l) => l.url.endsWith(".doc"))?.format).toBe("doc");
  });

  it("falls back to the file name when a label has no date (100_170826.txt)", () => {
    const links = parseOfficialListing(fixtureText("savings_gov_pk/pages/rs-100-prize-bond-draw.html"));
    expect(links.find((l) => l.url.endsWith("100_170826.txt"))?.drawDate).toBe("2026-08-17");
  });

  it("reads the official draw date list (Premium 40000 since June 2017)", () => {
    const list = parseOfficialDateList(fixtureText("savings_gov_pk_legacy/date-lists/ajax-9.html"));
    expect(list[0]).toEqual({ stateId: 172, drawDate: "2017-06-12" });
    expect(list[list.length - 1]?.drawDate).toBe("2026-09-10");
    expect(new Set(list.map((e) => e.drawDate)).size).toBe(list.length);
  });

  it("reads official number search answers, won and not won", () => {
    expect(parseOfficialSpot(fixtureText("savings_gov_pk_legacy/spot/40000_143_370978.html"), "370978")).toEqual({
      number: "370978",
      won: true,
      tier: 1,
      amountPkr: 75_000_000,
      city: "Multan",
      drawNumber: 55,
      drawDate: "2013-09-02",
    });
    expect(parseOfficialSpot(fixtureText("savings_gov_pk_legacy/spot/40000_143_370987.html"), "370987").won).toBe(false);
  });
});

describe("prizeinfo.net pages", () => {
  it("reads first and second prize records with draw numbers and cities", () => {
    const rows = parsePrizeinfoRecord(fixtureText("prizeinfo_net/200-prize-bond-first-second-record.html"));
    expect(rows.length).toBe(107);
    expect(rows[0]).toEqual({
      drawNumber: 107,
      tier1: [516806],
      tier2: [381066, 425087, 796229, 799273, 844138],
      city: "Muzaffarabad",
      drawDate: "2026-09-15",
    });
    const premium = parsePrizeinfoRecord(fixtureText("prizeinfo_net/25000-premium-prize-bond-first-second-record.html"));
    expect(premium[premium.length - 1]).toMatchObject({ drawNumber: 1, tier1: [794905, 874214], drawDate: "2021-03-10" });
  });

  it("reads the yearly schedule including premium bonds and future draws", () => {
    const rows = parsePrizeinfoSchedule(fixtureText("prizeinfo_net/schedule-2026.html"));
    expect(rows).toHaveLength(24);
    expect(rows).toContainEqual({ denominationCode: "40000P", drawNumber: 39, drawDate: "2026-12-10", city: "Lahore" });
    expect(rows).toContainEqual({ denominationCode: "750", drawNumber: 108, drawDate: "2026-10-15", city: "Rawalpindi" });
  });
});
