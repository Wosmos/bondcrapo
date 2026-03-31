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

const DENOM_URL_MAP: Record<number, string> = {
  100: "rs-100-prize-bond-draw",
  200: "rs-200-prize-bond-draw",
  750: "rs-750-prize-bond-draw",
  1500: "rs-1500-prize-bond-draw",
  25000: "premium-prize-bond-rs-25000",
  40000: "premium-prize-bond-rs-40000",
};

const SAVINGS_DENOMS = [100, 200, 750, 1500, 25000, 40000];
const ALL_DENOMS = [100, 200, 750, 1500, 7500, 15000, 25000, 40000];

export interface ScrapeJob {
  source: string;
  denomination: number;
  date: string;
  year: string;
  url: string;
}

export interface ScrapeResult {
  source: string;
  denomination: number;
  jobsFound: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

/** Get all available scrape targets for a given source+denomination */
async function fetchDrawListings(
  source: "savings_gov_pk" | "prizeinfo_net",
  denomination: number
): Promise<ScrapeJob[]> {
  const jobs: ScrapeJob[] = [];

  if (source === "savings_gov_pk") {
    if (!SAVINGS_DENOMS.includes(denomination)) return [];
    const slug = DENOM_URL_MAP[denomination];
    if (!slug) return [];

    const url = `https://savings.gov.pk/${slug}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
    });
    const html = await res.text();

    // Parse h2 tags to find year headers and draw links
    let currentYear = "";
    const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gs;
    let match;
    while ((match = h2Regex.exec(html)) !== null) {
      const inner = match[1];
      const plainText = inner.replace(/<[^>]+>/g, "").trim();

      if (/^\d{4}$/.test(plainText)) {
        currentYear = plainText;
        continue;
      }

      const linkMatch = inner.match(/href=["']([^"']*\.txt[^"']*)["']/i);
      if (linkMatch && currentYear) {
        let fileUrl = linkMatch[1];
        if (!fileUrl.startsWith("http")) {
          fileUrl = fileUrl.startsWith("/")
            ? `https://savings.gov.pk${fileUrl}`
            : `https://savings.gov.pk/${fileUrl}`;
        }
        jobs.push({
          source: "savings_gov_pk",
          denomination,
          date: plainText,
          year: currentYear,
          url: fileUrl,
        });
      }
    }
  } else if (source === "prizeinfo_net") {
    const url = `https://www.prizeinfo.net/results/${denomination}/`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 BondCheck Scraper" },
    });
    const html = await res.text();

    const linkRegex = new RegExp(
      `<a[^>]+href=["'](/results/${denomination}/\\d+/)["'][^>]*>(.*?)</a>`,
      "gs"
    );
    let match2;
    while ((match2 = linkRegex.exec(html)) !== null) {
      const href = match2[1];
      const text = match2[2].replace(/<[^>]+>/g, "").trim();
      const yearMatch = text.match(/20\d{2}/);
      jobs.push({
        source: "prizeinfo_net",
        denomination,
        date: text,
        year: yearMatch ? yearMatch[0] : "",
        url: `https://www.prizeinfo.net${href}`,
      });
    }
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

  // Build batch insert values
  const rows: [string, number, string, string, string, string, number][] = [];

  if (firstPrize) {
    rows.push([job.source, job.denomination, job.date, job.year, firstPrize, "1st", structure["1st"].amount]);
  }
  for (const num of secondPrizes) {
    rows.push([job.source, job.denomination, job.date, job.year, num, "2nd", structure["2nd"].amount]);
  }
  for (const num of thirdPrizes) {
    rows.push([job.source, job.denomination, job.date, job.year, num, "3rd", structure["3rd"].amount]);
  }

  let inserted = 0;
  // Batch in chunks of 200 to avoid query size limits
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk
      .map(
        (_, idx) =>
          `($${idx * 7 + 1}, $${idx * 7 + 2}, $${idx * 7 + 3}, $${idx * 7 + 4}, $${idx * 7 + 5}, $${idx * 7 + 6}, $${idx * 7 + 7})`
      )
      .join(", ");
    const params = chunk.flat();

    const result = await sqlClient.query(
      `INSERT INTO winners (source, denomination, draw_date, draw_year, bond_number, prize_position, prize_amount)
       VALUES ${values}
       ON CONFLICT (source, denomination, draw_date, bond_number) DO NOTHING`,
      params
    );
    inserted += result.rowCount ?? chunk.length;
  }

  return inserted;
}

/** Scrape one source+denomination combo — called by server action or cron */
export async function scrapeOne(
  source: "savings_gov_pk" | "prizeinfo_net",
  denomination: number
): Promise<ScrapeResult> {
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
    const jobs = await fetchDrawListings(source, denomination);
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
export function getAllScrapeTargets(): { source: "savings_gov_pk" | "prizeinfo_net"; denomination: number }[] {
  const targets: { source: "savings_gov_pk" | "prizeinfo_net"; denomination: number }[] = [];
  for (const denom of SAVINGS_DENOMS) {
    targets.push({ source: "savings_gov_pk", denomination: denom });
  }
  for (const denom of ALL_DENOMS) {
    targets.push({ source: "prizeinfo_net", denomination: denom });
  }
  return targets;
}
