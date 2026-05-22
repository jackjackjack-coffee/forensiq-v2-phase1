// lib/fraud-logic/rsf.ts
// ─────────────────────────────────────────────────────────────────
// Relative Size Factor analysis — vendor-normalized transaction sizing.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction } from '../types/transaction';

export interface RsfResult {
  /** Relative Size Factor: transaction amount ÷ vendor median */
  rsf: number;
  /** true if RSF > 3.0 (ACFE threshold) */
  rsf_flag: boolean;
  /** Z-score of amount within vendor population */
  rsf_zscore: number;
  /** Vendor median amount (reference value) */
  vendor_median: number;
  /** Vendor transaction count (sample size) */
  vendor_count: number;
}

/**
 * Relative Size Factor: transaction amount ÷ median amount for the same vendor.
 *
 * Accounting basis: A $100k payment is suspicious from a $10k/transaction
 * office supply vendor — but normal from a law firm. RSF normalizes for
 * vendor-specific pricing to surface disproportionate charges that raw
 * amount thresholds would miss.
 *
 * Red flag: Vendor historically billing $5k/month submits a $75k invoice
 * → RSF = 15 → immediate escalation warranted.
 *
 * Common fraud schemes detected:
 * - Fictitious vendor invoices (single large charge from a shell company)
 * - Vendor collusion: real vendor submits inflated year-end invoice
 * - Purchasing card misuse: employee splits large personal purchase
 *   across multiple small vendors but one vendor spikes
 *
 * Standard: ACFE Fraud Examiners Manual — Billing Schemes chapter.
 * AICPA AU-C 240.A22 — disaggregation of analytical procedure data by vendor.
 * Threshold: RSF > 3.0 triggers flag (transaction is 3× vendor median).
 *
 * @param transactions - Full ledger being analyzed
 * @returns Per-transaction RSF scores and flags
 */
export function computeRsf(transactions: RawTransaction[]): RsfResult[] {
  if (transactions.length === 0) return [];

  // Build vendor statistics
  const vendorAmounts = groupBy(transactions, (t) => t.vendor);
  const vendorStats = new Map<string, { median: number; mean: number; std: number; count: number }>();

  for (const [vendor, txns] of vendorAmounts.entries()) {
    const amounts = txns.map((t) => t.amount).sort((a, b) => a - b);
    vendorStats.set(vendor, {
      median: median(amounts),
      mean: mean(amounts),
      std: stdDev(amounts),
      count: amounts.length,
    });
  }

  // Portfolio-wide median: fallback baseline when a vendor has too few
  // transactions to form a reliable median of its own. This is the shell-
  // company case — a fictitious vendor with 1-3 huge invoices would otherwise
  // have RSF≈1.0 against itself and never flag.
  const MIN_VENDOR_SAMPLE = 5;
  const portfolioSorted = transactions.map((t) => t.amount).sort((a, b) => a - b);
  const portfolioMedian = median(portfolioSorted);

  return transactions.map((txn) => {
    const stats = vendorStats.get(txn.vendor);

    if (!stats || stats.median === 0) {
      return {
        rsf: 1,
        rsf_flag: false,
        rsf_zscore: 0,
        vendor_median: stats?.median ?? txn.amount,
        vendor_count: stats?.count ?? 1,
      };
    }

    // For low-sample vendors, the vendor's own median is unreliable; compare
    // against the portfolio median (typical of *any* transaction in the ledger).
    const useFallback = stats.count < MIN_VENDOR_SAMPLE && portfolioMedian > 0;
    const baseline = useFallback ? portfolioMedian : stats.median;

    const rsf = txn.amount / baseline;
    const rsf_flag = rsf > 3.0;

    // Z-score: (x - mean) / std. If std is 0 (single-transaction vendor), use 0.
    const rsf_zscore = stats.std > 0 ? (txn.amount - stats.mean) / stats.std : 0;

    return {
      rsf,
      rsf_flag,
      rsf_zscore,
      vendor_median: stats.median,
      vendor_count: stats.count,
    };
  });
}

/**
 * Returns the top N vendors by flagged transaction count.
 * Useful for the audit summary report — focuses investigation effort.
 */
export function getTopRsfVendors(
  transactions: RawTransaction[],
  results: RsfResult[],
  n = 10
): Array<{ vendor: string; flag_count: number; total_exposure: number; max_rsf: number }> {
  const vendorFlagMap = new Map<
    string,
    { flag_count: number; total_exposure: number; max_rsf: number }
  >();

  transactions.forEach((txn, i) => {
    const result = results[i];
    if (!result) return;
    const existing = vendorFlagMap.get(txn.vendor) ?? {
      flag_count: 0,
      total_exposure: 0,
      max_rsf: 0,
    };
    vendorFlagMap.set(txn.vendor, {
      flag_count: existing.flag_count + (result.rsf_flag ? 1 : 0),
      total_exposure: existing.total_exposure + (result.rsf_flag ? txn.amount : 0),
      max_rsf: Math.max(existing.max_rsf, result.rsf),
    });
  });

  return Array.from(vendorFlagMap.entries())
    .filter(([, v]) => v.flag_count > 0)
    .map(([vendor, v]) => ({ vendor, ...v }))
    .sort((a, b) => b.total_exposure - a.total_exposure)
    .slice(0, n);
}

// ── Statistical utilities ─────────────────────────────────────────

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}
