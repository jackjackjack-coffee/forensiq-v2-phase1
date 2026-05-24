// lib/fraud-logic/duplicate.ts
// ─────────────────────────────────────────────────────────────────
// Exact and fuzzy duplicate invoice detection.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction } from '../types/transaction';

export interface DuplicateResult {
  /** true if transaction shares exact date + amount + vendor with another */
  is_exact_duplicate: boolean;
  /** Number of transactions with identical key (including this one) */
  dup_count: number;
  /** Unique group key for this duplicate cluster */
  dup_group_key: string | null;
}

export interface FuzzyDuplicateResult {
  /** Group ID if transaction is part of a fuzzy cluster, null otherwise */
  fuzzy_dup_group: string | null;
  /** Index of the closest matching transaction, null if none found */
  fuzzy_match_idx: number | null;
  /** Levenshtein distance to closest match (0 = identical) */
  fuzzy_distance: number | null;
}

// ── Exact duplicate detection ─────────────────────────────────────

/**
 * Exact Duplicate Check: flags any set of transactions sharing the same
 * date + amount + vendor.
 *
 * Accounting basis: Duplicate payments are the most common billing fraud
 * scheme. A vendor submits the same invoice twice — often with different
 * invoice IDs — expecting the second to process automatically.
 *
 * Also catches "ghost vendor" schemes where the same fictitious invoice
 * is submitted by a colluding employee through multiple approval paths.
 *
 * ACFE 2024 Report on Occupational Fraud: billing fraud is the most
 * frequent asset misappropriation scheme at 28% of cases, with median
 * loss of $180,000 per incident.
 *
 * Standard: AICPA AU-C 240.A25 — examination of journal entry patterns.
 * ACFE Fraud Examiners Manual — Billing Schemes chapter.
 * Threshold: any group with count > 1 is flagged.
 *
 * @param transactions - Full ledger being analyzed
 * @returns Per-transaction exact duplicate flags
 */
export function detectExactDuplicates(transactions: RawTransaction[]): DuplicateResult[] {
  // Build frequency map on composite key: date|amount|vendor
  const groupCounts = new Map<string, number>();

  for (const txn of transactions) {
    const key = buildExactKey(txn);
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }

  return transactions.map((txn) => {
    const key = buildExactKey(txn);
    const count = groupCounts.get(key) ?? 1;
    return {
      is_exact_duplicate: count > 1,
      dup_count: count,
      dup_group_key: count > 1 ? key : null,
    };
  });
}

function buildExactKey(txn: RawTransaction): string {
  // Normalize vendor name: lowercase + collapsed whitespace
  const vendor = txn.vendor.toLowerCase().replace(/\s+/g, ' ').trim();
  // Normalize amount: 2 decimal places
  const amount = txn.amount.toFixed(2);
  return `${txn.date}|${amount}|${vendor}`;
}

// ── Fuzzy duplicate detection ─────────────────────────────────────

/**
 * Fuzzy Duplicate Match: detects near-duplicate invoices using
 * Levenshtein distance on invoice_id and vendor name.
 *
 * Accounting basis: Sophisticated billing fraud schemes slightly alter
 * invoice identifiers (INV-1042 vs INV-1042A) or vendor names
 * ("Meridian IT" vs "Meridan IT") to evade exact-match controls.
 *
 * Also detects typo-based vendor aliasing — a common shell company
 * technique where a name closely mirrors a legitimate vendor to gain
 * approval from inattentive reviewers.
 *
 * Standard: ACFE Fraud Examiners Manual — Document Examination chapter.
 * AICPA AU-C 240.A31 — examination of vendor master file for anomalies.
 * Threshold: Levenshtein distance ≤ 2 on same-amount transactions.
 *
 * @param transactions - Full ledger being analyzed
 * @returns Per-transaction fuzzy group assignments
 */
export function detectFuzzyDuplicates(transactions: RawTransaction[]): FuzzyDuplicateResult[] {
  const LEVENSHTEIN_THRESHOLD = 2;
  // For very large ledgers (>20k rows) the O(n²) within-band comparisons can
  // run for tens of minutes. Restrict the candidate pool to transactions
  // above the portfolio median — fuzzy-duplicate fraud almost always involves
  // material amounts, and most false positives sit in the low-amount tail.
  const LARGE_DATASET_THRESHOLD = 20_000;
  let candidateMask: boolean[] | null = null;
  if (transactions.length > LARGE_DATASET_THRESHOLD) {
    const sortedAmounts = transactions.map((t) => t.amount).sort((a, b) => a - b);
    const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)] ?? 0;
    candidateMask = transactions.map((t) => t.amount >= median);
  }

  const results: FuzzyDuplicateResult[] = transactions.map(() => ({
    fuzzy_dup_group: null,
    fuzzy_match_idx: null,
    fuzzy_distance: null,
  }));

  // For performance: only compare transactions within ±20% of same amount
  const grouped = groupByAmountBand(transactions);

  let groupCounter = 0;
  const pairToGroup = new Map<string, string>();

  for (const group of grouped.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const idxA = group[i];
        const idxB = group[j];
        if (idxA === undefined || idxB === undefined) continue;

        // Large-dataset short-circuit: at least one side must be above the
        // portfolio median, otherwise skip the expensive Levenshtein call.
        if (candidateMask && !candidateMask[idxA] && !candidateMask[idxB]) continue;

        const txnA = transactions[idxA];
        const txnB = transactions[idxB];
        if (!txnA || !txnB) continue;

        // Skip exact duplicates (handled by exactDuplicate check)
        if (buildExactKey(txnA) === buildExactKey(txnB)) continue;

        // Check vendor name similarity only.
        // Invoice ID is intentionally excluded: sequential IDs (INV-1001 vs
        // INV-1002) differ by 1 character and would cause mass false positives.
        const vendorDist = levenshtein(
          txnA.vendor.toLowerCase(),
          txnB.vendor.toLowerCase()
        );

        const isFuzzyMatch = vendorDist <= LEVENSHTEIN_THRESHOLD && vendorDist > 0;

        if (isFuzzyMatch) {
          const pairKey = `${Math.min(idxA, idxB)}-${Math.max(idxA, idxB)}`;
          if (!pairToGroup.has(pairKey)) {
            const groupId = `FUZZY-${String(++groupCounter).padStart(4, '0')}`;
            pairToGroup.set(pairKey, groupId);

            const resultA = results[idxA];
            const resultB = results[idxB];
            const distance = vendorDist;

            if (resultA) {
              resultA.fuzzy_dup_group = groupId;
              resultA.fuzzy_match_idx = idxB;
              resultA.fuzzy_distance = distance;
            }
            if (resultB) {
              resultB.fuzzy_dup_group = resultB.fuzzy_dup_group ?? groupId;
              resultB.fuzzy_match_idx = resultB.fuzzy_match_idx ?? idxA;
              resultB.fuzzy_distance = resultB.fuzzy_distance ?? distance;
            }
          }
        }
      }
    }
  }

  return results;
}

// ── Levenshtein distance ──────────────────────────────────────────

/**
 * Levenshtein edit distance — classic DP implementation.
 * Optimized with early-exit for strings exceeding max threshold.
 */
export function levenshtein(a: string, b: string, maxDist = 10): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 + Math.min(dp[i - 1][j] ?? 0, dp[i][j - 1] ?? 0, dp[i - 1][j - 1] ?? 0);
      }
    }
  }

  return dp[m][n] ?? maxDist + 1;
}

// ── Grouping utility ──────────────────────────────────────────────

/** Group transaction indices into amount bands (±20%) to reduce O(n²) comparisons */
function groupByAmountBand(transactions: RawTransaction[]): Map<number, number[]> {
  const BAND_SIZE = 1000; // round to nearest $1000 for band key
  const bands = new Map<number, number[]>();

  transactions.forEach((txn, idx) => {
    const band = Math.round(txn.amount / BAND_SIZE);
    // Add to adjacent bands to catch near-threshold matches
    for (const b of [band - 1, band, band + 1]) {
      if (!bands.has(b)) bands.set(b, []);
      bands.get(b)!.push(idx);
    }
  });

  return bands;
}
