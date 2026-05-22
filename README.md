# ForensiQ

> Browser-based forensic accounting engine that surfaces fraud signals in a transaction ledger using statistical, ML, and pattern-based detectors — all running client-side so audit data never leaves the auditor's machine.

**Live demo:** https://forensiq-v2-phase1.vercel.app

---

## What it does

Drop a CSV of vendor payments. In a few seconds you get:

- A **portfolio risk score** (0–100) with a tiered breakdown (LOW / MEDIUM / HIGH / CRITICAL)
- **Per-transaction risk scores** with the specific detectors that fired
- A **Benford's Law** report on first- and second-digit conformity (Nigrini MAD ranges)
- A **vendor-level view** ranked by average risk score, click-through to all transactions
- An **Excel risk report** export for the audit work paper

Auditor data stays in the browser — there is no server-side persistence of transactions.

## Why this exists

Most billing fraud is statistically detectable. The ACFE 2024 Report on Occupational Fraud puts billing schemes at 28% of all asset-misappropriation cases, with a median loss of $180,000 per incident. The detection techniques — Benford's Law, relative-size factor analysis, duplicate clustering, anomaly detection — are well-documented in forensic accounting literature but live mostly inside expensive proprietary tools like ACL, IDEA, and Caseware.

ForensiQ packages those same techniques into a free, in-browser workflow.

## Detection layers

The pipeline runs nine detectors in three layers, then computes a composite score per transaction.

### Layer 1 — Statistical

| Detector | What it catches | Standard |
|---|---|---|
| **Benford's Law (1st digit)** | Fabricated invoices — humans pick digits non-uniformly (too few 1s, too many 5s/9s). Conformity classified by Nigrini's MAD thresholds. | ACFE Digital Analysis chapter |
| **Benford's Law (2nd digit)** | More sensitive to subtle manipulation than 1st-digit; flags "rounded-up to next dollar" patterns. | Nigrini 2012 |
| **Round number test** | Excessive `$X,000` or `$X,500` amounts → fabricated estimates rather than actual invoices. | ACFE Fraud Examiners Manual |

### Layer 2 — Pattern

| Detector | What it catches | Standard |
|---|---|---|
| **Isolation Forest** (200 trees, 0.05 contamination) | Outlier amounts: single huge payment to a small vendor, structuring patterns. | Liu et al. 2008 / sklearn defaults |
| **Relative Size Factor (RSF)** | `amount / vendor_median > 3.0` — surfaces $75k charges from a vendor that normally bills $5k. | AICPA AU-C 240.A22 |
| **Exact duplicates** | Same `date + amount + vendor` → vendor double-billed the same invoice. | AICPA AU-C 240.A25 |
| **Fuzzy duplicates** | Levenshtein-2 on vendor names within an amount band — catches "Meridian IT" vs "Meridan IT" shell-company aliasing. | ACFE Document Examination chapter |
| **Split invoices** | Three $9.3k payments from one vendor in five days → splitting a $28k purchase to evade a $10k approval threshold. | ACFE Billing Schemes chapter |

### Layer 3 — Text & external verification

| Detector | What it catches |
|---|---|
| **Description audit** | Vague descriptions ("Misc", "Consulting", "Services") and known fraud keywords. |
| **EDGAR vendor lookup** | Is this vendor a real SEC-registered entity? Catches fictitious shell vendors. |
| **OFAC sanctions screen** | Is this vendor on the U.S. Treasury sanctions list? Mandatory check; violations are federal crimes. |
| **Nominatim address geocoding** | Does the vendor address resolve to a real location? Catches mail-drop and ghost-vendor schemes. |

### Composite scoring

`composite-score.ts` rolls each transaction's detector outputs into a 0–100 score with weights drawn from ACFE incidence rates, then assigns a `RiskTier` and aggregates portfolio-level metrics (estimated exposure, outlier rate, duplicate rate, etc.).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js client)                                   │
│                                                             │
│   CSV → parseCsv (auto-detects amount column)               │
│        ↓                                                    │
│   ┌─────────────────────────────────────┐                   │
│   │  Web Worker — analysis.worker.ts    │                   │
│   │  ├─ 9 detectors (pure TS)           │                   │
│   │  └─ fetch /api/external-verify ─────┼──► EDGAR          │
│   └─────────────────────────────────────┘   OFAC            │
│        ↓ progress + result                  Nominatim       │
│   composite-score → portfolio rollup                        │
│        ↓                                                    │
│   IndexedDB-free localStorage history (gzip-compressed)     │
└─────────────────────────────────────────────────────────────┘
```

**Why a Web Worker?** Fuzzy Levenshtein is O(n²); a 200-tree isolation forest over 10k transactions takes 10–30 s. Running it on the main thread triggered the browser's "unresponsive page" dialog. The worker keeps the UI thread free for progress updates and interaction.

**Why client-side everything?** Auditors deal with sensitive financial data under privilege. Shipping a CSV to an unknown server is a non-starter for many firms. The trade-off is processing time — analysis runs in the user's CPU, not a fleet of servers — but for the typical 1k–10k transaction ledger that's acceptable.

**Type discipline.** `lib/types/transaction.ts` is the single source of truth. External data enters as `unknown` and is narrowed through type guards. No `any` in the detector code.

## Tech stack

| | |
|---|---|
| Framework | Next.js 14 (App Router), React 18 |
| Language | TypeScript 5.4, strict mode |
| Styling | Tailwind CSS, shadcn/ui (Radix Nova) |
| Charts | Recharts |
| CSV | papaparse with column auto-detection |
| Compression | pako (gzip) for localStorage persistence |
| Excel export | xlsx |
| Testing | Jest + ts-jest, 38 passing tests |
| Deployment | Vercel |

## Local development

The Next.js app lives in `forensiq-v2/`, not the repo root.

```bash
cd forensiq-v2
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # Jest
npm run build        # production build
```

There's a "Generate Sample" button on the upload screen if you don't have a CSV — it generates 500–10k synthetic transactions with embedded fraud patterns (shell vendors, duplicate invoices, split purchases, Benford-violating fabricated runs) for end-to-end testing.

## Roadmap

ForensiQ Phase 1 is a single-user, in-browser tool. Planned for Phase 2:

- **Server-side persistence** for multi-engagement audit firms (Supabase + RLS)
- **Diff mode** — compare current ledger to last quarter and surface deltas
- **Vendor master file analysis** — duplicate vendors with different bank accounts, vendors sharing addresses with employees
- **PDF audit work-paper export** with detector-by-detector commentary
- **Real-time mode** — Webhook from accounting system → screened in real time

## Standards and references

- ACFE 2024 *Report to the Nations* — billing fraud incidence and median loss figures
- ACFE *Fraud Examiners Manual* — Billing Schemes, Digital Analysis, Document Examination chapters
- AICPA AU-C 240 — auditor's consideration of fraud
- Nigrini, M. (2012). *Benford's Law: Applications for Forensic Accounting* — MAD conformity ranges
- Liu, Ting, & Zhou (2008) — *Isolation Forest* (ICDM)

## License

MIT
