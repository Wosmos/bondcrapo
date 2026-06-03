import type { Page } from "@playwright/test";

/** Contract-shaped responses for the home board, so tests do not depend on live data. */
export const BOARD_FIXTURES = {
  "/api/v1/bonds/latest": {
    data: [
      {
        id: 1,
        denominationCode: "750",
        drawNumber: 104,
        drawDate: "2026-10-15",
        city: "Karachi",
        status: "verified",
        completeness: "full",
        resultChecksum: null,
        publishedAt: null,
        verifiedAt: null,
      },
      {
        id: 2,
        denominationCode: "1500",
        drawNumber: 105,
        drawDate: "2026-08-15",
        city: "Lahore",
        status: "disputed",
        completeness: "top",
        resultChecksum: null,
        publishedAt: null,
        verifiedAt: null,
      },
    ],
  },
  "/api/v1/markets/local-rates": {
    data: [
      {
        country: "PK",
        city: "",
        metal: "XAU",
        karat: 24,
        unit: "tola",
        currency: "PKR",
        price: 400000,
        kind: "derived",
        source: "test fixture",
        date: "2026-10-15",
        observedAt: "2026-10-15T10:00:00+05:00",
      },
    ],
  },
  "/api/v1/markets/fx/pkr": {
    data: [
      { currency: "USD", date: "2026-10-15", kind: "open_market", buy: 280.1, sell: 281.2, source: "fixture A", observedAt: "2026-10-15T10:00:00+05:00" },
      { currency: "USD", date: "2026-10-15", kind: "interbank", buy: 279.5, sell: 279.9, source: "fixture B", observedAt: "2026-10-15T10:00:00+05:00" },
    ],
  },
} as const;

export async function mockBoard(page: Page) {
  for (const [path, body] of Object.entries(BOARD_FIXTURES)) {
    await page.route(`**${path}*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
    );
  }
}

export const PAGES = ["/", "/about", "/about/data", "/privacy", "/terms", "/offline"] as const;
export const url = (locale: string, path: string) => (path === "/" ? `/${locale}` : `/${locale}${path}`);

/** The board loads when it nears the viewport; scroll to it and wait for the fixture data. */
export async function showBoard(page: Page) {
  await page.locator("#board-title").scrollIntoViewIfNeeded();
  await page.getByText(/Karachi/).waitFor();
}
