# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Directory

The Next.js app lives in the `forensiq-v2/` subdirectory, **not** the repo root. All `npm` / `npx` commands must be run from there:

```bash
cd forensiq-v2
```

Vercel deployment is configured with Root Directory = `forensiq-v2` for the same reason. Do not move files out of this subdirectory without updating both `package.json` paths and the Vercel project setting.

## Commands

All commands run from `forensiq-v2/`:

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Type-check (no emit) | `npm run typecheck` |
| Run all tests | `npm test` |
| Watch tests | `npm run test:watch` |
| Coverage | `npm run test:coverage` |
| Run a single test file | `npx jest tests/fraud-logic/detectors.test.ts` |
| Run a single test by name | `npx jest -t "benford"` |

## Architecture

### Three-layer fraud detection pipeline

Single entry point: `runForensicAnalysis(transactions, options)` in `lib/fraud-logic/index.ts`. It orchestrates all detectors in dependency order and returns a single `AnalysisResult`. Adding a new detector means: write the detector function, call it inside `runForensicAnalysis`, plug its output into `assembleAnalyzedTransaction`, and update `triggered_detectors` logic in `composite-score.ts`.

The detector layers (in order):

1. **Statistical** — `benford.ts` (1st digit, 2nd digit, round numbers).
2. **Pattern** — `isolation-forest.ts`, `rsf.ts` (Relative Size Factor vs vendor median), `duplicate.ts` (exact + Levenshtein fuzzy), `split-invoice.ts` (transactions clustered just under approval thresholds).
3. **Text & External** — `description-audit.ts` (keyword scoring), and three external API clients in `lib/external/`: `edgar.ts` (SEC), `ofac.ts` (sanctions), `nominatim.ts` (address geocoding).

`composite-score.ts` rolls all detector outputs into a 0–100 risk score and a `RiskTier`, then computes a portfolio-level summary.

### External APIs are NOT wired up yet

Files in `lib/external/` are functional but never called from the UI. They were designed to run server-side (Supabase Edge Function or Next.js API route) because the APIs have CORS restrictions and rate limits (Nominatim: 1 req/sec). The browser flow currently only uses Layer 1 + Layer 2 + the text portion of Layer 3. To wire them up, create a Next.js Route Handler under `app/api/` that the browser calls after local analysis, then merge the external results back into the `external_results` map argument of `runForensicAnalysis`.

### Browser-only analysis

Everything in `lib/fraud-logic/` and `lib/parsers/` is pure TypeScript with no React/DOM/Node dependencies — it runs identically in browser and Jest. All current analysis happens client-side: CSV parsed in browser, detectors run in browser, no network calls. This is intentional (auditor data never leaves the machine).

### Type system

`lib/types/transaction.ts` is the single source of truth for all domain types (`RawTransaction`, `AnalyzedTransaction`, `AnalysisResult`, etc.). External/unknown data enters typed as `unknown` and is narrowed through the type guards at the bottom of that file (`isRawTransaction`, `isRiskTier`). No `any`.

### tsconfig has split strictness

The project's `tsconfig.json` has `noUncheckedIndexedAccess: false` and `exactOptionalPropertyTypes: false` to keep production builds passing. **Jest re-enables both** via inline `tsconfig` overrides in `jest.config.js`. If you change either flag, change it in both files together — otherwise tests and prod will diverge silently.

### CSV parser is permissive

`lib/parsers/csv.ts` only requires a numeric `amount` column. If no column matches the amount aliases (`amount`, `total`, `value`, etc.), `detectNumericColumn` samples 20 rows and picks whichever column has the highest ratio of positive numeric values (≥50% threshold). Missing `date` falls back to today; missing `vendor` falls back to `'Unknown'`. Column-count mismatches are padded with empty strings rather than skipped.

### UI structure

`app/page.tsx` is a single-file SPA with five sidebar sections (`upload`, `overview`, `transactions`, `benford`, `detectors`). Sections beyond `upload` are locked until an `AnalysisResult` exists in state. shadcn/ui (Radix Nova preset) is installed (`components/ui/`) but the page mostly uses raw Tailwind — shadcn primitives are available if needed.

## Things that have bitten us

- **Build fails with "No Output Directory named 'public'"** — Vercel Framework Preset is set to "Other" instead of Next.js. Fix in Project Settings → Framework Settings.
- **404 on Vercel root URL** — Root Directory is not set to `forensiq-v2`.
- **`exactOptionalPropertyTypes` errors** when assigning `undefined` to optional fields — use conditional spread `...(cond ? {} : { key })` instead. The flag is currently off in tsconfig but tests still enforce it.
