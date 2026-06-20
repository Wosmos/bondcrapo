import { inArray, eq } from "drizzle-orm";
import { sourceDocuments, type Db } from "@bondcheck/db";
import { DENOMINATION_CODES, type DenominationCode } from "@bondcheck/shared";
import { sha256Hex, type FetchResult, type Fetcher } from "../fetcher";
import type { FormPoster } from "./form-post";
import { isLegacyBody, legacyCandidate } from "./legacy";
import {
  HTML_PARSER_VERSION,
  denominationForDateListUrl,
  parseOfficialDateList,
  parseOfficialListing,
  parseOfficialSpot,
  parsePrizeinfoRecord,
  parsePrizeinfoSchedule,
  parseSpotUrl,
  type OfficialFileLink,
} from "./parse-html";
import { RESULT_PARSER_VERSION, parseResultText } from "./parse-result-text";
import { extractPdfText, isPdfBody, pdfBody, pdfBodyText, PDF_NO_TEXT_MARKER } from "./pdf";
import { denominationForLegacyId, denominationForPageUrl, denominationForPrizeinfoUrl, OFFICIAL_LEGACY_BASE } from "./sources";
import type { Candidate, DocumentSource } from "./types";

export interface StoredDocument {
  sha256: string;
  source: DocumentSource;
  url: string;
  fetchedAt: Date;
  contentType: string | null;
  bytes: number | null;
  body: string;
}

/** Inserts a document unless its content is already stored. Returns true when it was new. */
export async function storeDocument(db: Db, doc: StoredDocument): Promise<boolean> {
  const res = await db
    .insert(sourceDocuments)
    .values(doc)
    .onConflictDoNothing({ target: sourceDocuments.sha256 })
    .returning({ sha256: sourceDocuments.sha256 });
  return res.length > 0;
}

export async function documentsByUrl(db: Db, urls: string[]): Promise<Map<string, StoredDocument>> {
  const out = new Map<string, StoredDocument>();
  for (let i = 0; i < urls.length; i += 200) {
    const rows = await db.select().from(sourceDocuments).where(inArray(sourceDocuments.url, urls.slice(i, i + 200)));
    for (const r of rows) {
      const prev = out.get(r.url);
      if (!prev || prev.fetchedAt < r.fetchedAt) out.set(r.url, r as StoredDocument);
    }
  }
  return out;
}

export async function documentsBySource(db: Db, source: DocumentSource): Promise<StoredDocument[]> {
  return (await db.select().from(sourceDocuments).where(eq(sourceDocuments.source, source))) as StoredDocument[];
}

export async function documentsBySha(db: Db, shas: string[]): Promise<StoredDocument[]> {
  if (!shas.length) return [];
  return (await db.select().from(sourceDocuments).where(inArray(sourceDocuments.sha256, shas))) as StoredDocument[];
}

/** Fetches a GET document (TXT, HTML or PDF) and turns it into a storable document. */
export async function fetchDocument(fetcher: Fetcher, url: string, source: DocumentSource): Promise<StoredDocument> {
  const isPdf = /\.pdf(?:$|\?)/i.test(url);
  const res = await fetcher.get(url, { bytes: isPdf });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return documentFromFetch(res, source, isPdf);
}

export async function documentFromFetch(res: FetchResult, source: DocumentSource, isPdf: boolean): Promise<StoredDocument> {
  let body = res.body;
  if (isPdf) {
    try {
      body = pdfBody(await extractPdfText(res.data ?? new Uint8Array()));
    } catch {
      body = `${PDF_NO_TEXT_MARKER} unreadable\n`;
    }
  }
  return {
    sha256: res.sha256,
    source,
    url: res.url,
    fetchedAt: res.fetchedAt,
    contentType: res.contentType,
    bytes: res.byteLength,
    body,
  };
}

/**
 * POST responses are stored with a first line recording the form that was posted, and their
 * sha256 is computed over the stored body: two searches can return byte identical pages ("no
 * prize") that must stay separate documents.
 */
async function postDocument(poster: FormPoster, url: string, storedUrl: string, form: Record<string, string>): Promise<StoredDocument> {
  const res = await poster.post(url, form);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${storedUrl}`);
  const body = `<!-- bondcheck form ${new URLSearchParams(form).toString()} -->\n${res.body}`;
  return {
    sha256: await sha256Hex(body),
    source: "savings_gov_pk_legacy",
    url: storedUrl,
    fetchedAt: res.fetchedAt,
    contentType: res.contentType,
    bytes: res.byteLength,
    body,
  };
}

export function fetchOfficialDateList(poster: FormPoster, code: DenominationCode, legacyId: number): Promise<StoredDocument> {
  return postDocument(poster, `${OFFICIAL_LEGACY_BASE}/ajaxData.php`, `${OFFICIAL_LEGACY_BASE}/ajaxData.php#id=${legacyId}`, {
    id: String(legacyId),
  });
}

export function fetchOfficialSpot(
  poster: FormPoster,
  legacyId: number,
  stateId: number,
  date: string,
  number: string,
): Promise<StoredDocument> {
  return postDocument(
    poster,
    `${OFFICIAL_LEGACY_BASE}/results.php`,
    `${OFFICIAL_LEGACY_BASE}/results.php#country=${legacyId}&state=${stateId}&date=${date}&number=${number}`,
    { country: String(legacyId), state: String(stateId), range_from: "", range_to: "", pb_number_list: number, btnsearch: "Search" },
  );
}

/** Links found on the stored official denomination pages, keyed by file URL. */
export function listingIndex(pages: StoredDocument[]): Map<string, OfficialFileLink & { denominationCode: DenominationCode }> {
  const out = new Map<string, OfficialFileLink & { denominationCode: DenominationCode }>();
  for (const page of [...pages].sort((a, b) => a.fetchedAt.getTime() - b.fetchedAt.getTime())) {
    const code = denominationForPageUrl(page.url);
    if (!code) continue;
    for (const link of parseOfficialListing(page.body)) out.set(link.url, { ...link, denominationCode: code });
  }
  return out;
}

function headerDenomination(face: number | null, premium: boolean): DenominationCode | null {
  if (face === null) return null;
  const code = `${face}${premium ? "P" : ""}`;
  return (DENOMINATION_CODES as readonly string[]).includes(code) ? (code as DenominationCode) : null;
}

export interface DocumentContext {
  listing: Map<string, OfficialFileLink & { denominationCode: DenominationCode }>;
}

/** Every candidate a stored document yields (a record page yields one per draw). */
export function candidatesFromDocument(doc: StoredDocument, ctx: DocumentContext): Candidate[] {
  if (doc.source === "legacy_db_snapshot" && isLegacyBody(doc.body)) {
    const c = legacyCandidate(doc.body, doc.sha256);
    return c ? [c] : [];
  }

  if (doc.source === "savings_gov_pk") {
    if (denominationForPageUrl(doc.url)) return [];
    const link = ctx.listing.get(doc.url);
    const pdf = isPdfBody(doc.body);
    const text = pdf ? pdfBodyText(doc.body) : doc.body;
    if (text === null) return [];
    const parsed = parseResultText(text);
    const fromHeader = headerDenomination(parsed.header.faceValue, parsed.header.premium);
    // The page a file is linked from decides its denomination: one official file calls a Rs 200
    // draw "PREMIUM PRIZE BONDS", so the header is only a cross-check.
    const code = link?.denominationCode ?? fromHeader;
    if (!code) return [];
    const notes = [...parsed.warnings];
    if (fromHeader && link && fromHeader !== link.denominationCode && Number.parseInt(fromHeader, 10) !== Number.parseInt(link.denominationCode, 10)) {
      notes.push(`file header names Rs ${parsed.header.faceValue}, the page lists it under ${link.denominationCode}`);
    }
    const drawDate = link?.drawDate ?? parsed.header.drawDate;
    if (link?.drawDate && parsed.header.drawDate && link.drawDate !== parsed.header.drawDate) {
      notes.push(`file header date ${parsed.header.drawDate}, page label ${link.drawDate}`);
    }
    const tiers: Candidate["tiers"] = {};
    const prizes: Candidate["prizes"] = {};
    for (const t of [1, 2, 3] as const) {
      if (parsed.tiers[t].numbers.length) tiers[t] = parsed.tiers[t].numbers;
      prizes[t] = parsed.tiers[t].header;
    }
    return [
      {
        kind: pdf ? "official_pdf" : "official_txt",
        documentSha256: doc.sha256,
        parserVersion: RESULT_PARSER_VERSION,
        denominationCode: code,
        drawDate,
        drawNumber: parsed.header.drawNumber,
        city: parsed.header.city,
        tiers,
        prizes,
        notes,
      },
    ];
  }

  if (doc.source === "savings_gov_pk_legacy") {
    const spot = parseSpotUrl(doc.url);
    if (spot) {
      const code = denominationForLegacyId(spot.legacyId);
      if (!code) return [];
      const r = parseOfficialSpot(doc.body, spot.number);
      return [
        {
          kind: "official_spot",
          documentSha256: doc.sha256,
          parserVersion: HTML_PARSER_VERSION,
          denominationCode: code,
          drawDate: r.drawDate ?? spot.drawDate,
          drawNumber: r.drawNumber,
          city: r.city,
          tiers: {},
          prizes: r.won && r.tier ? { [r.tier]: { amountPkr: r.amountPkr, count: null } } : {},
          spot: [{ number: Number(spot.number), won: r.won, tier: r.tier, amountPkr: r.amountPkr }],
        },
      ];
    }
    const code = denominationForDateListUrl(doc.url);
    if (!code) return [];
    return parseOfficialDateList(doc.body).map((e) => ({
      kind: "official_catalog" as const,
      documentSha256: doc.sha256,
      parserVersion: HTML_PARSER_VERSION,
      denominationCode: code,
      drawDate: e.drawDate,
      drawNumber: null,
      city: null,
      tiers: {},
      prizes: {},
    }));
  }

  if (doc.source === "prizeinfo_net") {
    const code = denominationForPrizeinfoUrl(doc.url);
    if (code) {
      return parsePrizeinfoRecord(doc.body).map((row) => {
        const tiers: Candidate["tiers"] = {};
        if (row.tier1.length) tiers[1] = row.tier1;
        if (row.tier2.length) tiers[2] = row.tier2;
        return {
          kind: "prizeinfo_record" as const,
          documentSha256: doc.sha256,
          parserVersion: HTML_PARSER_VERSION,
          denominationCode: code,
          drawDate: row.drawDate,
          drawNumber: row.drawNumber,
          city: row.city,
          tiers,
          prizes: {},
        };
      });
    }
    if (/\/schedule\/\d{4}\/?$/.test(doc.url)) {
      return parsePrizeinfoSchedule(doc.body)
        .filter((r) => (DENOMINATION_CODES as readonly string[]).includes(r.denominationCode))
        .map((r) => ({
          kind: "prizeinfo_schedule" as const,
          documentSha256: doc.sha256,
          parserVersion: HTML_PARSER_VERSION,
          denominationCode: r.denominationCode,
          drawDate: r.drawDate,
          drawNumber: r.drawNumber,
          city: r.city,
          tiers: {},
          prizes: {},
        }));
    }
  }
  return [];
}
