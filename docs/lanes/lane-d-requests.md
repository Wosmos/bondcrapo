# Lane D requests for the integrator

Changes Lane D needs in files it does not own, plus contracts other lanes should know about.

## Files edited outside the Lane D list (please keep on merge)

1. `apps/web/eslint.config.mjs`: registers the `bondcheck/logical-properties` rule from `src/styles/lint/logical-properties.mjs` (D1 scope: logical-properties lint rule). `src/legacy/**` is ignored until the legacy adapter is removed. Other lanes' code must pass it: use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `border-s`, `rounded-s` and so on.
2. `apps/web/vitest.config.mts`: inlines `next-intl` (it imports `next/server` without an extension, which plain Node ESM cannot resolve) and excludes `e2e/**` from Vitest.
3. `apps/web/package.json`: devDependencies `@playwright/test` 1.64.1 and `@axe-core/playwright` 4.14.0, script `e2e`. Other lanes need the same packages for their Playwright suites; please keep a single version.
4. `apps/web/playwright.config.ts` (new, shared): Pixel 7 Chromium against `next start`. Other lanes add specs under `apps/web/e2e/<area>/`; the config does not need to change.
5. `apps/web/.gitignore`: Playwright and Lighthouse CI output folders.
6. `apps/web/src/app/sitemap-index.xml/route.ts` (new): sitemap index, because `generateSitemaps` serves `/sitemap/<id>.xml` without one.
7. `apps/web/src/app/icon.svg`, `apps/web/src/app/apple-icon.png`, `apps/web/public/icons/*` (new): favicon, Apple touch icon and manifest icons.
8. `apps/web/src/app/[locale]/{offline,not-found.tsx,[...rest]}` (new): offline fallback page for the service worker and the localized 404.

## Please delete

- `apps/web/src/app/globals.css`: replaced by `apps/web/src/styles/globals.css`. It is only kept because it is not a Lane D file and the legacy components still reference its classes; delete it together with `src/legacy/**`.

## Shared package

- `packages/shared/src/client.ts`: `ApiClient` calls `this.opts.fetch ?? globalThis.fetch` as a detached function. Browsers throw `TypeError: Illegal invocation` for a detached `window.fetch`. Fix: `const doFetch = this.opts.fetch ?? ((input, init) => globalThis.fetch(input, init));`. Lane D passes a bound wrapper meanwhile (`src/components/home/live-data.ts`); every web client of `ApiClient` without a custom `fetch` is affected.
- Optional: `"sideEffects": false` in `packages/shared/package.json` so unused contracts tree-shake out of client bundles.

## Contracts for other lanes

### All page lanes (A, B, C, E)

- Metadata: `pageMetadata({ locale, path, title, description, noIndex? })` from `@/i18n/seo` gives canonical, `en`/`ur`/`x-default` alternates, Open Graph and Twitter tags. `path` is locale-less. `jsonLd(data)` serialises JSON-LD safely.
- Formatting with Western digits in both locales: `formatAmount`, `formatNumber`, `formatDate`, `intlLocale` from `@/i18n/format`.
- URL builders: `paths` from `@/i18n/paths`. The sitemap and the home page link with them.
- Client translations: the root layout sends only the messages its own islands use (`src/i18n/client-messages.ts`), so pages stay light. A lane whose client component calls `useTranslations` wraps that island:
  ```tsx
  const messages = pickNamespaces(await getMessages(), ["bonds"]);
  <NextIntlClientProvider messages={messages}><Checker /></NextIntlClientProvider>
  ```
  Server components can use `getTranslations` for any namespace as before.
- Text pages can reuse `ContentPage` and `Sections` from `@/components/content/ContentPage`; icons from `@/components/shell/icons`.
- Design tokens are Tailwind colours: `paper`, `surface`, `surface-2`, `ink`, `ink-2`, `line`, `line-strong`, `brand`, `brand-strong`, `on-brand`, `gold`, `gold-ink`, `success`, `warning`, `danger`, `info`. They switch with the theme; please avoid raw `slate-*` colours so dark mode works. `font-display` is the heading face, `ur:` targets Urdu pages only.
- The nav registry is rendered as the header nav (md and up) and a bottom tab bar on phones. The tab bar icon is chosen by nav `id` (`bonds`, `markets`, `wallet`, `download`); keep labels short (they wrap to two lines at most).

### Lane A (bonds)

- URL shapes assumed by the sitemap, home page and service worker match `features/bonds/labels.ts`: `/prize-bonds/750`, `/prize-bonds/premium-40000`, `/prize-bonds/<slug>/<drawNumber>`, `/prize-bonds/schedule/<year>`, `/prize-bonds/check`, `/prize-bonds/coverage`. `src/i18n/paths.ts` mirrors `denominationSlug`; after merge it can import it from `@/features/bonds/labels` instead.
- The home quick check submits `GET /prize-bonds/check?numbers=<6 digits>&denomination=<code or empty>`. The checker already reads `numbers`; please also preselect `denomination` when present.
- The service worker caches draw result pages stale while revalidate (pattern `/(en|ur)/prize-bonds/<slug>/<number>`), and `GET /api/v1/bonds/*` responses stale while revalidate.

### Lane B (markets)

- Sitemap (your request 5): `src/i18n/sitemap.ts` lists the same paths as `features/markets/sitemap.ts` (`/gold-rate`, `/gold-rate/<country slug>`, `/gold-rate/pakistan/<city>`, `/silver-rate`, `/metals/<metal>`, `/currency`, 16 `/<ccy>-to-pkr` pairs) with `ur` and `x-default` alternates. After merge, replace the market loops in `publicPages` with `marketsSitemapPaths()` so the list has one owner.
- Home tiles (your request 6): the board stays a client island over `/api/v1/markets/*` through the shared `ApiClient` (the plan's wording, and it keeps the home page fully static); your server loaders are not needed for it.
- Theme tokens (your request 7): map `surface` in `features/markets/components/bits.tsx` to `bg-surface border-line` and chart `TONES` to `var(--brand)`, `var(--gold)`, `var(--info)` so dark mode works.
- The home board reads `GET /markets/local-rates?country=PK` (24K, tola, PKR) and `GET /markets/fx/pkr` (USD open market and interbank) and shows `kind` as Reported or Estimated plus `source`.

### Lane C (wallet)

- Done (your request 4): `public/sw.js` sets `self.BONDCHECK_SHELL_SW = true` and then imports `/sw-push.js` (wrapped in try/catch). The worker never caches `/api/v1/wallets/*`.
- Done (your request 6): the privacy page links to `/my/settings` for export and deletion.
- `robots.txt` disallows `/en/my` and `/ur/my`; use `noIndex: true` in `pageMetadata` for wallet pages too.
- The privacy page lists exactly what the wallet stores (wallet id, hashed token, hashed sync code, bonds with optional label, matches with seen state, locale and time zone, push endpoint) and says deletion is under My bonds, Settings, Delete wallet. Please keep that path or tell the integrator to update `messages/*/common.json` (`privacy`).

### Lane E (mobile and downloads)

- Done: the `[locale]` layout renders the skip link and the single `<main id="main">` landmark; `/download` is in the footer (Explore column, from the nav registry) and in the sitemap for both locales.
- After merge run `bun run --cwd apps/mobile messages` so the app's copy of `common.json` matches.

### CI

- Add a job (after build) running `bun run --cwd apps/web e2e` with `npx playwright install --with-deps chromium`, and a non-blocking Lighthouse job: `bunx @lhci/cli@0.15.1 autorun --config=apps/web/lighthouserc.json` from `apps/web`. The `/gold-rate` and `/currency` URLs in that config only exist after Lane B merges.
- The visual snapshot baselines (`apps/web/e2e/visual.spec.ts-snapshots/*-linux.png`) were recorded on Linux; regenerate them on the CI runner image once (`bun run e2e --update-snapshots`) if fonts render differently there.

## Owner actions

- Set `APP_BASE_URL` to the production origin on the website host: canonical URLs, hreflang, the sitemap and Open Graph tags use it (falling back to Vercel's production host name, then localhost).
- Native Urdu review of `apps/web/messages/ur/common.json`, in particular the Privacy and Terms texts (ADR 0005).
- Privacy and Terms have no contact address; add one (an email for data requests) when available.
