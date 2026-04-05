import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Prize structure per denomination
const PRIZE_STRUCTURE: Record<
  number,
  Record<string, { amount: number; count: number }>
> = {
  100: { "1st": { amount: 700000, count: 1 }, "2nd": { amount: 200000, count: 3 }, "3rd": { amount: 1000, count: 1199 } },
  200: { "1st": { amount: 750000, count: 1 }, "2nd": { amount: 250000, count: 5 }, "3rd": { amount: 1250, count: 2394 } },
  750: { "1st": { amount: 1500000, count: 1 }, "2nd": { amount: 500000, count: 3 }, "3rd": { amount: 9300, count: 1696 } },
  1500: { "1st": { amount: 3000000, count: 1 }, "2nd": { amount: 1000000, count: 3 }, "3rd": { amount: 18500, count: 1696 } },
  7500: { "1st": { amount: 15000000, count: 1 }, "2nd": { amount: 5000000, count: 3 }, "3rd": { amount: 93000, count: 1696 } },
  15000: { "1st": { amount: 30000000, count: 1 }, "2nd": { amount: 10000000, count: 3 }, "3rd": { amount: 185000, count: 1696 } },
  25000: { "1st": { amount: 50000000, count: 1 }, "2nd": { amount: 15000000, count: 3 }, "3rd": { amount: 312000, count: 1696 } },
  40000: { "1st": { amount: 75000000, count: 1 }, "2nd": { amount: 25000000, count: 3 }, "3rd": { amount: 500000, count: 1696 } },
};

const ALL_DENOMS = [100, 200, 750, 1500, 7500, 15000, 25000, 40000];

export interface ScrapeJob {
  source: string;
  denomination: number;
  date: string;
  year: string;
  url: string;
  drawNumber?: number;
  city?: string;
}

export interface ScrapeResult {
  source: string;
  denomination: number;
  jobsFound: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/** Get all available scrape targets for prizeinfo.net */
async function fetchDrawListings(
  denomination: number
): Promise<ScrapeJob[]> {
  const jobs: ScrapeJob[] = [];
  const url = `https://www.prizeinfo.net/results/${denomination}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
  });
  const html = await res.text();

  const linkRegex = new RegExp(
    `<a[^>]+href=["'](/results/${denomination}/\\d+/)["'][^>]*>(.*?)</a>`,
    "gs"
  );
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    const yearMatch = text.match(/20\d{2}/);
    jobs.push({
      source: "prizeinfo_net",
      denomination,
      date: text,
      year: yearMatch ? yearMatch[0] : "",
      url: `https://www.prizeinfo.net${href}`,
    });
  }

  return jobs;
}

/** Download a TXT file from a draw URL and parse bond numbers */
async function fetchAndParseDraw(
  job: ScrapeJob
): Promise<{ numbers: string[]; error?: string }> {
  try {
    let textUrl = job.url;

    // For prizeinfo.net, the URL points to an HTML page — find the .txt link inside
    if (job.source === "prizeinfo_net" && !job.url.endsWith(".txt")) {
      const res = await fetch(job.url, {
        headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
      });
      const html = await res.text();
      const txtMatch = html.match(/href=["']([^"']*\.txt[^"']*)["']/i);
      if (!txtMatch) {
        return { numbers: [], error: `No .txt link found at ${job.url}` };
      }
      textUrl = txtMatch[1];
      if (!textUrl.startsWith("http")) {
        textUrl = `https://www.prizeinfo.net${textUrl.startsWith("/") ? "" : "/"}${textUrl}`;
      }
    }

    const res = await fetch(textUrl, {
      headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
    });
    const text = await res.text();

    // Extract all 6-digit numbers
    const allNumbers = text.match(/\b\d{6}\b/g) || [];
    // Deduplicate preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const num of allNumbers) {
      if (!seen.has(num)) {
        seen.add(num);
        unique.push(num);
      }
    }

    return { numbers: unique };
  } catch (err) {
    return { numbers: [], error: String(err) };
  }
}

/** Insert parsed winners into Neon DB */
async function insertWinners(
  sqlClient: NeonQueryFunction<false, true>,
  job: ScrapeJob,
  numbers: string[]
): Promise<number> {
  if (!numbers.length) return 0;

  const structure = PRIZE_STRUCTURE[job.denomination];
  if (!structure) return 0;

  const expected2nd = structure["2nd"].count;
  const firstPrize = numbers[0];
  const secondPrizes = numbers.slice(1, 1 + expected2nd);
  const thirdPrizes = numbers.slice(1 + expected2nd);

  // Build batch insert values: [source, denom, drawNumber|null, date, year, city|null, bondNumber, position, amount]
  const rows: (string | number | null)[][] = [];

  if (firstPrize) {
    rows.push([job.source, job.denomination, job.drawNumber ?? null, job.date, job.year, job.city ?? null, firstPrize, "1st", structure["1st"].amount]);
  }
  for (const num of secondPrizes) {
    rows.push([job.source, job.denomination, job.drawNumber ?? null, job.date, job.year, job.city ?? null, num, "2nd", structure["2nd"].amount]);
  }
  for (const num of thirdPrizes) {
    rows.push([job.source, job.denomination, job.drawNumber ?? null, job.date, job.year, job.city ?? null, num, "3rd", structure["3rd"].amount]);
  }

  let inserted = 0;
  // Batch in chunks of 200 to avoid query size limits
  const chunkSize = 200;
  const colCount = 9;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map(
        (_, idx) =>
          `($${idx * colCount + 1}, $${idx * colCount + 2}, $${idx * colCount + 3}, $${idx * colCount + 4}, $${idx * colCount + 5}, $${idx * colCount + 6}, $${idx * colCount + 7}, $${idx * colCount + 8}, $${idx * colCount + 9})`
      )
      .join(", ");
    const params = chunk.flat();

    const result = await sqlClient.query(
      `INSERT INTO winners (source, denomination, draw_number, draw_date, draw_year, city, bond_number, prize_position, prize_amount)
       VALUES ${values}
       ON CONFLICT (source, denomination, draw_date, bond_number) DO UPDATE SET
         draw_number = COALESCE(EXCLUDED.draw_number, winners.draw_number),
         city = COALESCE(EXCLUDED.city, winners.city)`,
      params
    );
    inserted += result.rowCount ?? chunk.length;
  }

  return inserted;
}

/** Scrape one source+denomination combo — called by server action or cron */
export async function scrapeOne(
  source: "prizeinfo_net" | "pkprizebond_com",
  denomination: number
): Promise<ScrapeResult> {
  // For pkprizebond, delegate to its dedicated scraper
  if (source === "pkprizebond_com") {
    return scrapePkPrizeBond(denomination);
  }

  const sqlClient = neon(process.env.DATABASE_URL!, { fullResults: true });
  const result: ScrapeResult = {
    source,
    denomination,
    jobsFound: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Get existing draws from DB for this source+denom
    const existing = await sqlClient.query(
      `SELECT DISTINCT draw_date FROM winners WHERE source = $1 AND denomination = $2`,
      [source, denomination]
    );
    const existingDates = new Set(
      (existing.rows as { draw_date: string }[]).map((r) => r.draw_date)
    );

    // 2. Fetch listings
    const jobs = await fetchDrawListings(denomination);
    result.jobsFound = jobs.length;

    // 3. Filter to new draws only
    const newJobs = jobs.filter((j) => !existingDates.has(j.date));
    result.skipped = jobs.length - newJobs.length;

    // 4. Process each new draw
    for (const job of newJobs) {
      const { numbers, error } = await fetchAndParseDraw(job);
      if (error) {
        result.errors.push(error);
        continue;
      }
      const count = await insertWinners(sqlClient, job, numbers);
      result.inserted += count;
    }
  } catch (err) {
    result.errors.push(String(err));
  }

  return result;
}

/** Get a list of all source+denomination combos to scrape */
export function getAllScrapeTargets(): { source: "prizeinfo_net" | "pkprizebond_com"; denomination: number }[] {
  const targets: { source: "prizeinfo_net" | "pkprizebond_com"; denomination: number }[] = [];
  for (const denom of ALL_DENOMS) {
    targets.push({ source: "prizeinfo_net", denomination: denom });
  }
  for (const denom of ALL_DENOMS) {
    targets.push({ source: "pkprizebond_com", denomination: denom });
  }
  return targets;
}

// ─── Historical First/Second Prize Record Scraper ────────────────────────────

/**
 * Denominations that have a first/second record page on prizeinfo.net.
 * The number of 2nd-prize columns varies: Rs 200 has 5, all others have 3.
 * Discontinued denoms (1000, 2500, 5000, 10000) redirect to the homepage
 * and are NOT included — they have no record page.
 */
const HISTORICAL_RECORD_DENOMS: { denomination: number; secondPrizeCount: number }[] = [
  { denomination: 100, secondPrizeCount: 3 },
  { denomination: 200, secondPrizeCount: 5 },
  { denomination: 750, secondPrizeCount: 3 },
  { denomination: 1500, secondPrizeCount: 3 },
  { denomination: 7500, secondPrizeCount: 3 },
  { denomination: 15000, secondPrizeCount: 3 },
  { denomination: 25000, secondPrizeCount: 3 },
  { denomination: 40000, secondPrizeCount: 3 },
];

/** Build URL for the first/second record page of a denomination */
function recordPageUrl(denomination: number): string {
  return `https://www.prizeinfo.net/${denomination}-prize-bond-first-second-record/`;
}

/**
 * Parse a DD-MM-YYYY date string into a normalized "D MonthName YYYY" draw_date
 * and extract the year.
 */
function parseDDMMYYYY(raw: string): { drawDate: string; drawYear: string } {
  const parts = raw.trim().split("-");
  if (parts.length !== 3) return { drawDate: raw.trim(), drawYear: "" };
  const [dd, mm, yyyy] = parts;
  const months = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthIdx = parseInt(mm, 10);
  const monthName = months[monthIdx] || mm;
  return {
    drawDate: `${parseInt(dd, 10)} ${monthName} ${yyyy}`,
    drawYear: yyyy,
  };
}

/** Strip HTML tags from a string */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Parsed row from a first/second record table */
interface HistoricalRow {
  drawNumber: number;
  firstPrize: string;
  secondPrizes: string[];
  city: string;
  drawDate: string; // normalized "D MonthName YYYY"
  drawYear: string;
}

/**
 * Fetch and parse a single denomination's first/second record page.
 * Each page contains a <table> with <tr>/<td> rows:
 *   Draw No. | 1st | 2nd | 2nd | 2nd [| 2nd | 2nd] | City | Date | Full List
 *
 * The "Full List" column contains a link and may be absent in some rows.
 */
async function fetchRecordPage(
  denomination: number,
  secondPrizeCount: number
): Promise<{ rows: HistoricalRow[]; error?: string }> {
  try {
    const url = recordPageUrl(denomination);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
    });
    if (!res.ok) {
      return { rows: [], error: `HTTP ${res.status} for ${url}` };
    }
    const html = await res.text();

    // Expected <td> per data row: Draw(1) + 1st(1) + 2nd(N) + City(1) + Date(1) + FullList(1)
    const minCols = secondPrizeCount + 4; // allow missing "Full List"

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const rows: HistoricalRow[] = [];

    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[1];

      // Skip header rows (contain <th>)
      if (/<th[\s>]/i.test(trContent)) continue;

      // Extract all <td> cell values
      const cells: string[] = [];
      let tdMatch;
      tdRegex.lastIndex = 0;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        cells.push(stripTags(tdMatch[1]));
      }

      if (cells.length < minCols) continue;

      // Column 0: Draw No.
      const drawNum = parseInt(cells[0], 10);
      if (isNaN(drawNum)) continue; // not a data row

      // Column 1: 1st prize number
      const firstPrize = cells[1].replace(/\s/g, "");
      if (!/^\d{6}$/.test(firstPrize)) continue; // sanity check

      // Columns 2..2+N-1: 2nd prize numbers
      const secondPrizes: string[] = [];
      for (let i = 2; i < 2 + secondPrizeCount; i++) {
        const num = cells[i]?.replace(/\s/g, "");
        if (num && /^\d{6}$/.test(num)) {
          secondPrizes.push(num);
        }
      }

      // Column after 2nd prizes: City
      const cityIdx = 2 + secondPrizeCount;
      const city = cells[cityIdx] || "";

      // Column after City: Date (DD-MM-YYYY)
      const dateIdx = cityIdx + 1;
      const rawDate = cells[dateIdx] || "";
      const { drawDate, drawYear } = parseDDMMYYYY(rawDate);

      rows.push({
        drawNumber: drawNum,
        firstPrize,
        secondPrizes,
        city,
        drawDate,
        drawYear,
      });
    }

    return { rows };
  } catch (err) {
    return { rows: [], error: String(err) };
  }
}

/**
 * Insert historical first/second prize rows into the DB.
 * Uses an UPSERT that also fills draw_number and city for existing rows.
 * Prize amounts are looked up from PRIZE_STRUCTURE.
 * Falls back to 0 if denomination not found (shouldn't happen for current denoms).
 */
async function insertHistoricalRows(
  sqlClient: NeonQueryFunction<false, true>,
  denomination: number,
  parsedRows: HistoricalRow[]
): Promise<number> {
  if (!parsedRows.length) return 0;

  const structure = PRIZE_STRUCTURE[denomination];
  const firstAmount = structure?.["1st"]?.amount ?? 0;
  const secondAmount = structure?.["2nd"]?.amount ?? 0;

  // Each winning number becomes one DB row
  // Tuple: [source, denomination, draw_number, draw_date, draw_year, city, bond_number, prize_position, prize_amount]
  const dbRows: (string | number)[][] = [];

  for (const row of parsedRows) {
    dbRows.push([
      "prizeinfo_net", denomination, row.drawNumber,
      row.drawDate, row.drawYear, row.city,
      row.firstPrize, "1st", firstAmount,
    ]);
    for (const num of row.secondPrizes) {
      dbRows.push([
        "prizeinfo_net", denomination, row.drawNumber,
        row.drawDate, row.drawYear, row.city,
        num, "2nd", secondAmount,
      ]);
    }
  }

  let inserted = 0;
  const chunkSize = 200;
  const colCount = 9;

  for (let i = 0; i < dbRows.length; i += chunkSize) {
    const chunk = dbRows.slice(i, i + chunkSize);
    const values = chunk
      .map(
        (_, idx) =>
          `($${idx * colCount + 1}, $${idx * colCount + 2}, $${idx * colCount + 3}, $${idx * colCount + 4}, $${idx * colCount + 5}, $${idx * colCount + 6}, $${idx * colCount + 7}, $${idx * colCount + 8}, $${idx * colCount + 9})`
      )
      .join(", ");
    const params = chunk.flat();

    const result = await sqlClient.query(
      `INSERT INTO winners (source, denomination, draw_number, draw_date, draw_year, city, bond_number, prize_position, prize_amount)
       VALUES ${values}
       ON CONFLICT (source, denomination, draw_date, bond_number)
       DO UPDATE SET draw_number = EXCLUDED.draw_number, city = EXCLUDED.city`,
      params
    );
    inserted += result.rowCount ?? chunk.length;
  }

  return inserted;
}

// ─── Schedule Page Scraper ───────────────────────────────────────────────────

/** Parsed row from a schedule page */
interface ScheduleRow {
  denomination: number;
  drawNumber: number;
  drawDate: string; // normalized "D MonthName YYYY"
  drawYear: string;
  city: string;
}

/**
 * Parse a denomination string from schedule pages to a numeric value.
 * Examples: "Rs. 750", "Rs. 1500", "Rs. 40000 Premium", "Rs. 25000 Premium"
 */
function parseDenominationText(text: string): number | null {
  const match = text.match(/Rs\.?\s*([\d,]+)/i);
  if (!match) return null;
  const num = parseInt(match[1].replace(/,/g, ""), 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse a long-format date string, e.g. "15 January 2024".
 * Returns { drawDate, drawYear }.
 */
function parseLongDate(raw: string): { drawDate: string; drawYear: string } {
  const trimmed = raw.trim();
  const yearMatch = trimmed.match(/(\d{4})/);
  return {
    drawDate: trimmed,
    drawYear: yearMatch ? yearMatch[1] : "",
  };
}

/**
 * Fetch and parse a single year's schedule page.
 * URL: https://www.prizeinfo.net/schedule/{year}/
 *
 * The table has columns: Sr. | Prize Bond | Draw Date and City | Action
 *   "Prize Bond" contains e.g. "Rs. 750 (Draw No. 97)"
 *   "Draw Date and City" contains e.g. "15 January 2024 (Sialkot)"
 */
async function fetchSchedulePage(year: number): Promise<{ rows: ScheduleRow[]; error?: string }> {
  try {
    const url = `https://www.prizeinfo.net/schedule/${year}/`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
    });
    if (!res.ok) {
      return { rows: [], error: `HTTP ${res.status} for ${url}` };
    }
    const html = await res.text();

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const rows: ScheduleRow[] = [];

    let trMatch;
    while ((trMatch = trRegex.exec(html)) !== null) {
      const trContent = trMatch[1];
      if (/<th[\s>]/i.test(trContent)) continue;

      const cells: string[] = [];
      let tdMatch;
      tdRegex.lastIndex = 0;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        cells.push(stripTags(tdMatch[1]));
      }

      // Expect at least 3 cells: Sr., Prize Bond, Draw Date and City
      if (cells.length < 3) continue;

      // Parse denomination and draw number from "Prize Bond" column
      // e.g. "Rs. 750 (Draw No. 97)" or "Rs. 40000 Premium (Draw No. 28)"
      const prizeBondCell = cells[1];
      const denomination = parseDenominationText(prizeBondCell);
      if (!denomination) continue;

      const drawNoMatch = prizeBondCell.match(/Draw\s*No\.?\s*(\d+)/i);
      const drawNumber = drawNoMatch ? parseInt(drawNoMatch[1], 10) : 0;

      // Parse date and city from "Draw Date and City" column
      // e.g. "15 January 2024 (Sialkot)"
      const dateAndCity = cells[2];
      const cityMatch = dateAndCity.match(/\(([^)]+)\)/);
      const city = cityMatch ? cityMatch[1].trim() : "";
      const dateStr = dateAndCity.replace(/\([^)]*\)/, "").trim();
      const { drawDate, drawYear } = parseLongDate(dateStr);

      rows.push({ denomination, drawNumber, drawDate, drawYear, city });
    }

    return { rows };
  } catch (err) {
    return { rows: [], error: String(err) };
  }
}

/**
 * Use schedule metadata to UPDATE existing rows that are missing draw_number or city.
 * Schedule pages don't have winning numbers, so this is metadata-only.
 */
async function upsertScheduleMetadata(
  sqlClient: NeonQueryFunction<false, true>,
  scheduleRows: ScheduleRow[]
): Promise<number> {
  if (!scheduleRows.length) return 0;

  let updated = 0;
  for (const row of scheduleRows) {
    if (!row.drawNumber && !row.city) continue;
    const result = await sqlClient.query(
      `UPDATE winners
       SET draw_number = COALESCE($1, draw_number),
           city        = COALESCE($2, city)
       WHERE source = 'prizeinfo_net'
         AND denomination = $3
         AND draw_date = $4
         AND (draw_number IS NULL OR city IS NULL)`,
      [row.drawNumber || null, row.city || null, row.denomination, row.drawDate]
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}

// ─── Exported Historical Functions ───────────────────────────────────────────

/** Get the list of historical record page targets */
export function getHistoricalTargets(): { denomination: number; secondPrizeCount: number; url: string }[] {
  return HISTORICAL_RECORD_DENOMS.map((d) => ({
    ...d,
    url: recordPageUrl(d.denomination),
  }));
}

/**
 * Scrape ALL historical first/second prize records from prizeinfo.net,
 * then backfill draw_number + city from schedule pages (2000 through current year).
 *
 * This is a heavy operation (fetches ~35 pages). Call from an admin page or cron.
 *
 * Returns a combined ScrapeResult where:
 *   - denomination = 0 (signifies "all denominations")
 *   - jobsFound = total record-page rows parsed across all denoms
 *   - inserted  = total DB rows inserted/upserted from record pages
 *   - skipped   = total DB rows updated from schedule metadata
 *   - errors    = accumulated errors from both phases
 */
export async function scrapeHistoricalRecords(): Promise<ScrapeResult> {
  const sqlClient = neon(process.env.DATABASE_URL!, { fullResults: true });
  const result: ScrapeResult = {
    source: "prizeinfo_net",
    denomination: 0,
    jobsFound: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  // ── Phase 1: Scrape first/second record pages ─────────────────────────────
  for (const { denomination, secondPrizeCount } of HISTORICAL_RECORD_DENOMS) {
    const { rows, error } = await fetchRecordPage(denomination, secondPrizeCount);
    if (error) {
      result.errors.push(`[record/${denomination}] ${error}`);
      continue;
    }

    result.jobsFound += rows.length;

    if (rows.length === 0) {
      result.errors.push(`[record/${denomination}] No rows parsed from record page`);
      continue;
    }

    try {
      const count = await insertHistoricalRows(sqlClient, denomination, rows);
      result.inserted += count;
    } catch (err) {
      result.errors.push(`[record/${denomination}] DB insert error: ${String(err)}`);
    }
  }

  // ── Phase 2: Scrape schedule pages to backfill draw_number + city ─────────
  const currentYear = new Date().getFullYear();
  for (let year = 2000; year <= currentYear; year++) {
    const { rows: scheduleRows, error } = await fetchSchedulePage(year);
    if (error) {
      result.errors.push(`[schedule/${year}] ${error}`);
      continue;
    }

    try {
      const updated = await upsertScheduleMetadata(sqlClient, scheduleRows);
      result.skipped += updated;
    } catch (err) {
      result.errors.push(`[schedule/${year}] DB update error: ${String(err)}`);
    }
  }

  return result;
}

/**
 * Scrape historical records for a SINGLE denomination.
 * Lighter-weight alternative — only fetches 1 record page + relevant schedule years.
 */
export async function scrapeHistoricalForDenom(denomination: number): Promise<ScrapeResult> {
  const sqlClient = neon(process.env.DATABASE_URL!, { fullResults: true });
  const result: ScrapeResult = {
    source: "prizeinfo_net",
    denomination,
    jobsFound: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  const config = HISTORICAL_RECORD_DENOMS.find((d) => d.denomination === denomination);
  if (!config) {
    result.errors.push(`No historical record page configured for denomination ${denomination}`);
    return result;
  }

  // Scrape the record page
  const { rows, error } = await fetchRecordPage(denomination, config.secondPrizeCount);
  if (error) {
    result.errors.push(error);
    return result;
  }

  result.jobsFound = rows.length;

  if (rows.length > 0) {
    try {
      result.inserted = await insertHistoricalRows(sqlClient, denomination, rows);
    } catch (err) {
      result.errors.push(`DB insert error: ${String(err)}`);
    }
  }

  // Backfill from schedule pages — only fetch years that appear in this denom's data
  const years = new Set(
    rows.map((r) => parseInt(r.drawYear, 10)).filter((y) => !isNaN(y))
  );
  for (const year of years) {
    const { rows: scheduleRows, error: schedErr } = await fetchSchedulePage(year);
    if (schedErr) {
      result.errors.push(`[schedule/${year}] ${schedErr}`);
      continue;
    }

    // Only apply schedule rows for this denomination
    const relevant = scheduleRows.filter((r) => r.denomination === denomination);
    try {
      const updated = await upsertScheduleMetadata(sqlClient, relevant);
      result.skipped += updated;
    } catch (err) {
      result.errors.push(`[schedule/${year}] DB update error: ${String(err)}`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// pkprizebond.com scraper
// ═══════════════════════════════════════════════════════════════════════════════

const PKPRIZEBOND_BASE = "http://www.pkprizebond.com";
const PKPRIZEBOND_SOURCE = "pkprizebond_com";

/** All denominations available on pkprizebond.com (site only has current ones) */
const PKPRIZEBOND_DENOMS = [100, 200, 750, 1500, 7500, 15000, 25000, 40000];

/** Data on the site starts from 2002 */
const PKPRIZEBOND_START_YEAR = 2002;

/** Small delay helper for rate limiting between fetches */
function pkDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch helper with retries and User-Agent header */
async function pkFetch(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
        redirect: "follow",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await pkDelay(1000 * (attempt + 1));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}

/**
 * Parsed draw listing from a pkprizebond.com schedule page.
 */
interface PkDrawListing {
  denomination: number;
  drawNumber: number;
  date: string; // e.g. "02-Jan-2010"
  city: string;
  linkPath: string; // e.g. "list/219-prize-bond-list-15000-dated-02-Jan-2010-at-Multan"
  year: string;
}

/**
 * Parsed prize data from an individual pkprizebond.com draw result page.
 */
interface PkDrawResult {
  drawNumber: number;
  date: string;
  city: string;
  denomination: number;
  firstPrizeAmount: number;
  secondPrizeAmount: number;
  thirdPrizeAmount: number;
  thirdPrizeCount: number;
  firstPrizeNumbers: string[];
  secondPrizeNumbers: string[];
  thirdPrizeNumbers: string[];
}

/**
 * Fetch the draw schedule page for a given year and extract all draw listings
 * that have result page links.
 *
 * URL: http://www.pkprizebond.com/draw-schedule/draw-schedule-{year}
 *
 * The schedule page has a table with columns:
 *   Draw Date | Day | Draw No. | Bond # (denomination) | Draw Place
 * and each row may contain a link like:
 *   list/{id}-prize-bond-list-{denom}-dated-{date}-at-{city}
 *
 * Note: The site duplicates each row, so we deduplicate by linkPath.
 */
async function fetchPkScheduleForYear(year: number): Promise<PkDrawListing[]> {
  const url = `${PKPRIZEBOND_BASE}/draw-schedule/draw-schedule-${year}`;
  const html = await pkFetch(url);
  const listings: PkDrawListing[] = [];
  const seen = new Set<string>();

  // Match links to draw result pages.
  // Link format: list/{id}-prize-bond-list-{denom}-dated-{date}-at-{city}
  // The link may be absolute or relative, possibly with a leading slash.
  const linkRegex = /<a[^>]+href=["']?\/?(?:http:\/\/(?:www\.)?pkprizebond\.com\/)?(list\/(\d+)-prize-bond-list-(\d+)-dated-([^"'\s]+)-at-([^"'\s>]+))["']?[^>]*>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const linkPath = match[1];
    const denom = parseInt(match[3], 10);
    const dateStr = match[4]; // e.g. "02-Jan-2010"
    const city = decodeURIComponent(match[5]).replace(/-/g, " ").trim();

    // Deduplicate — the site lists each draw twice in the table
    if (seen.has(linkPath)) continue;
    seen.add(linkPath);

    listings.push({
      denomination: denom,
      drawNumber: 0, // Will be filled from table or result page
      date: dateStr,
      city,
      linkPath,
      year: String(year),
    });
  }

  // Try to extract draw numbers from the table rows.
  // We scan each <tr> for both a draw result link and numeric cells.
  // Typical row: <td>#</td> <td>date</td> <td>day</td> <td>drawNo</td> <td>denom</td> <td>city</td>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[0];
    // Find if this row contains a draw result link
    const linkInRow = row.match(
      /list\/\d+-prize-bond-list-\d+-dated-[^"'\s]+-at-[^"'\s>]+/i
    );
    if (!linkInRow) continue;

    const listing = listings.find((l) => l.linkPath === linkInRow[0]);
    if (!listing || listing.drawNumber !== 0) continue;

    // Extract all <td> cell values
    const tdRegex2 = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex2.exec(row)) !== null) {
      tds.push(tdMatch[1].replace(/<[^>]+>/g, "").trim());
    }

    // Look for a numeric value that could be the draw number.
    // It should not match the denomination, and should be a reasonable number.
    for (const td of tds) {
      const num = parseInt(td, 10);
      if (
        !isNaN(num) &&
        num > 0 &&
        num < 10000 &&
        td === String(num) &&
        num !== listing.denomination
      ) {
        listing.drawNumber = num;
        break;
      }
    }
  }

  return listings;
}

/**
 * Parse an individual draw result page from pkprizebond.com.
 *
 * Page structure (observed from multiple denomination pages):
 *
 *   Heading: "Draw Result of Prize Bond {denom} Held at {city} On {day} {date}"
 *   Draw No: "National Savings Pakistan Draw No.{N}"
 *   1st:     "1st Prize Amount: Rs.{amount}/=" followed by bond number(s)
 *   2nd:     "2nd Prize Amount: Rs.{amount}/=" followed by bond numbers
 *   3rd:     "{count} Prizes of Rs.{amount}" followed by bond numbers
 *
 * Prize amounts are extracted from the page text, NOT hardcoded.
 * The number of 1st/2nd prize winners varies by denomination and era.
 */
function parsePkDrawResultPage(
  html: string,
  fallbackDenom: number,
  fallbackDate: string,
  fallbackCity: string
): PkDrawResult | null {
  // Convert HTML to plain text, preserving line breaks at block boundaries
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ");

  // Detect error/invalid pages (ID mismatch returns epoch date + zero denomination)
  if (/ERror/i.test(text) && /January 01[\s-]*1970/i.test(text)) {
    return null;
  }
  if (/Rs\.\s*0\s*\/=/i.test(text) && /Prize Bond 0/i.test(text)) {
    return null;
  }

  // ── Extract draw number: "Draw No.{N}" or "Draw No. {N}" ──
  let drawNumber = 0;
  const drawNoMatch = text.match(/Draw\s+No\.?\s*(\d+)/i);
  if (drawNoMatch) {
    drawNumber = parseInt(drawNoMatch[1], 10);
  }

  // ── Extract denomination from heading: "Prize Bond {denom}" ──
  let denomination = fallbackDenom;
  const denomMatch = text.match(/Prize Bond\s+(\d+)/i);
  if (denomMatch) {
    const parsed = parseInt(denomMatch[1], 10);
    if (parsed > 0) denomination = parsed;
  }

  // ── Extract city from heading: "Held at {city}" ──
  let city = fallbackCity;
  const cityMatch = text.match(/Held at\s+([A-Za-z]+)/i);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }

  // Use fallback date (from schedule link) — more reliable than parsing from text
  const date = fallbackDate;

  // ── Extract prize amounts from the page text ──
  // 1st Prize: "1st Prize Amount: Rs.{amount}/="
  let firstPrizeAmount = 0;
  const firstAmountMatch = text.match(
    /1st\s+Prize\s+Amount\s*:\s*Rs\.?\s*([\d,]+)/i
  );
  if (firstAmountMatch) {
    firstPrizeAmount = parseInt(firstAmountMatch[1].replace(/,/g, ""), 10);
  }

  // 2nd Prize: "2nd Prize Amount: Rs.{amount}/="
  let secondPrizeAmount = 0;
  const secondAmountMatch = text.match(
    /2nd\s+Prize\s+Amount\s*:\s*Rs\.?\s*([\d,]+)/i
  );
  if (secondAmountMatch) {
    secondPrizeAmount = parseInt(secondAmountMatch[1].replace(/,/g, ""), 10);
  }

  // 3rd Prize: "{count} Prizes of Rs.{amount}"
  let thirdPrizeAmount = 0;
  let thirdPrizeCount = 0;
  const thirdMatch = text.match(
    /(\d[\d,]*)\s+Prizes?\s+of\s+Rs\.?\s*([\d,]+)/i
  );
  if (thirdMatch) {
    thirdPrizeCount = parseInt(thirdMatch[1].replace(/,/g, ""), 10);
    thirdPrizeAmount = parseInt(thirdMatch[2].replace(/,/g, ""), 10);
  }

  // ── Find section boundaries to split numbers into prize tiers ──
  const firstPrizeIdx = text.search(/1st\s+Prize\s+Amount/i);
  const secondPrizeIdx = text.search(/2nd\s+Prize\s+Amount/i);
  const thirdPrizeIdx = text.search(/\d[\d,]*\s+Prizes?\s+of\s+Rs/i);

  if (firstPrizeIdx === -1 || secondPrizeIdx === -1) {
    return null; // Can't parse without clear section markers
  }

  // Helper to extract deduplicated 6-digit bond numbers from a text section
  const extractNumbers = (section: string): string[] => {
    const nums = section.match(/\b\d{6}\b/g) || [];
    const uniqueSet = new Set<string>();
    const unique: string[] = [];
    for (const n of nums) {
      if (!uniqueSet.has(n)) {
        uniqueSet.add(n);
        unique.push(n);
      }
    }
    return unique;
  };

  // 1st prize numbers: between "1st Prize Amount" and "2nd Prize Amount"
  const firstSection = text.substring(firstPrizeIdx, secondPrizeIdx);
  const firstPrizeNumbers = extractNumbers(firstSection);

  // 2nd prize numbers: between "2nd Prize Amount" and the 3rd prize marker (or end)
  const secondEndIdx = thirdPrizeIdx !== -1 ? thirdPrizeIdx : text.length;
  const secondSection = text.substring(secondPrizeIdx, secondEndIdx);
  const secondPrizeNumbers = extractNumbers(secondSection);

  // 3rd prize numbers: everything after "{count} Prizes of Rs.{amount}"
  let thirdPrizeNumbers: string[] = [];
  if (thirdPrizeIdx !== -1) {
    const thirdSection = text.substring(thirdPrizeIdx);
    thirdPrizeNumbers = extractNumbers(thirdSection);
  }

  // Validation: require at least a first prize number
  if (firstPrizeNumbers.length === 0) {
    return null;
  }

  return {
    drawNumber,
    date,
    city,
    denomination,
    firstPrizeAmount,
    secondPrizeAmount,
    thirdPrizeAmount,
    thirdPrizeCount,
    firstPrizeNumbers,
    secondPrizeNumbers,
    thirdPrizeNumbers,
  };
}

/**
 * Insert parsed draw results from pkprizebond.com into Neon DB.
 *
 * Prize amounts come from the page itself (not from PRIZE_STRUCTURE).
 * Uses UPSERT so re-running is safe — updates draw_number and city on conflict.
 */
async function insertPkWinners(
  sqlClient: NeonQueryFunction<false, true>,
  drawResult: PkDrawResult,
  year: string
): Promise<number> {
  // Build rows: [source, denomination, draw_number, draw_date, draw_year, city, bond_number, prize_position, prize_amount]
  const rows: (string | number | null)[][] = [];

  for (const num of drawResult.firstPrizeNumbers) {
    rows.push([
      PKPRIZEBOND_SOURCE,
      drawResult.denomination,
      drawResult.drawNumber || null,
      drawResult.date,
      year,
      drawResult.city || null,
      num,
      "1st",
      drawResult.firstPrizeAmount,
    ]);
  }

  for (const num of drawResult.secondPrizeNumbers) {
    rows.push([
      PKPRIZEBOND_SOURCE,
      drawResult.denomination,
      drawResult.drawNumber || null,
      drawResult.date,
      year,
      drawResult.city || null,
      num,
      "2nd",
      drawResult.secondPrizeAmount,
    ]);
  }

  for (const num of drawResult.thirdPrizeNumbers) {
    rows.push([
      PKPRIZEBOND_SOURCE,
      drawResult.denomination,
      drawResult.drawNumber || null,
      drawResult.date,
      year,
      drawResult.city || null,
      num,
      "3rd",
      drawResult.thirdPrizeAmount,
    ]);
  }

  if (rows.length === 0) return 0;

  let inserted = 0;
  const chunkSize = 200;
  const colCount = 9;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map(
        (_, idx) =>
          `($${idx * colCount + 1}, $${idx * colCount + 2}, $${idx * colCount + 3}, $${idx * colCount + 4}, $${idx * colCount + 5}, $${idx * colCount + 6}, $${idx * colCount + 7}, $${idx * colCount + 8}, $${idx * colCount + 9})`
      )
      .join(", ");
    const params = chunk.flat();

    const queryResult = await sqlClient.query(
      `INSERT INTO winners (source, denomination, draw_number, draw_date, draw_year, city, bond_number, prize_position, prize_amount)
       VALUES ${values}
       ON CONFLICT (source, denomination, draw_date, bond_number) DO UPDATE SET
         draw_number = EXCLUDED.draw_number,
         city = EXCLUDED.city`,
      params
    );
    inserted += queryResult.rowCount ?? chunk.length;
  }

  return inserted;
}

/**
 * Scrape pkprizebond.com for a specific denomination.
 *
 * Strategy:
 * 1. Iterate through yearly schedule pages (2002 to current year)
 * 2. Extract draw listings with result-page links for the target denomination
 * 3. Check DB for already-scraped draws (by draw_date) and skip them
 * 4. Fetch each new draw's result page, parse prizes and winning numbers
 * 5. Insert into DB with prize amounts taken from the page
 *
 * Rate limiting: 300ms between schedule page fetches, 500ms between draw pages.
 */
export async function scrapePkPrizeBond(
  denomination: number
): Promise<ScrapeResult> {
  const sqlClient = neon(process.env.DATABASE_URL!, { fullResults: true });
  const result: ScrapeResult = {
    source: PKPRIZEBOND_SOURCE,
    denomination,
    jobsFound: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // 1. Get existing draws from DB for this source + denomination
    const existing = await sqlClient.query(
      `SELECT DISTINCT draw_date FROM winners WHERE source = $1 AND denomination = $2`,
      [PKPRIZEBOND_SOURCE, denomination]
    );
    const existingDates = new Set(
      (existing.rows as { draw_date: string }[]).map((r) => r.draw_date)
    );

    // 2. Collect all draw listings from schedule pages across all years
    const currentYear = new Date().getFullYear();
    const allListings: PkDrawListing[] = [];

    for (let year = PKPRIZEBOND_START_YEAR; year <= currentYear; year++) {
      try {
        const listings = await fetchPkScheduleForYear(year);
        const denomListings = listings.filter(
          (l) => l.denomination === denomination
        );
        allListings.push(...denomListings);
      } catch (err) {
        result.errors.push(`Schedule ${year}: ${String(err)}`);
      }
      // Rate limit between schedule page fetches
      await pkDelay(100);
    }

    result.jobsFound = allListings.length;

    // 3. Filter to draws not yet in DB
    const newListings = allListings.filter((l) => !existingDates.has(l.date));
    result.skipped = allListings.length - newListings.length;

    // 4. Fetch and parse each new draw result page
    for (const listing of newListings) {
      try {
        const drawUrl = `${PKPRIZEBOND_BASE}/${listing.linkPath}`;
        const html = await pkFetch(drawUrl);

        const drawResult = parsePkDrawResultPage(
          html,
          listing.denomination,
          listing.date,
          listing.city
        );

        if (!drawResult) {
          result.errors.push(`Failed to parse: ${drawUrl}`);
          continue;
        }

        // Prefer draw number from the result page; fall back to schedule table
        if (!drawResult.drawNumber && listing.drawNumber) {
          drawResult.drawNumber = listing.drawNumber;
        }

        const count = await insertPkWinners(
          sqlClient,
          drawResult,
          listing.year
        );
        result.inserted += count;
      } catch (err) {
        result.errors.push(`Draw ${listing.date}: ${String(err)}`);
      }

      // Rate limit between draw page fetches
      await pkDelay(150);
    }
  } catch (err) {
    result.errors.push(String(err));
  }

  return result;
}

/**
 * Get all denomination targets for the pkprizebond.com source.
 * Returns a list of { source, denomination } objects for use by admin page or cron.
 */
export function getPkPrizeBondTargets(): {
  source: "pkprizebond_com";
  denomination: number;
}[] {
  return PKPRIZEBOND_DENOMS.map((denom) => ({
    source: "pkprizebond_com" as const,
    denomination: denom,
  }));
}
