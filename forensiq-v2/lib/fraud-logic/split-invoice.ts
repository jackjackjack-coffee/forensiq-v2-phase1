// lib/fraud-logic/split-invoice.ts
// ─────────────────────────────────────────────────────────────────
// Split invoice detection — identifies structuring patterns where
// a single large payment is broken into smaller amounts below
// approval thresholds.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction } from '../types/transaction';

export interface SplitInvoiceResult {
  /** true if this transaction is part of a suspected split-invoice cluster */
  is_split_invoice: boolean;
  /** Cluster ID if flagged, null otherwise */
  split_cluster_id: string | null;
  /** Combined amount of all transactions in the cluster */
  cluster_total: number | null;
  /** Number of transactions in the cluster */
  cluster_size: number | null;
  /** The approval threshold the cluster appears to be evading */
  suspected_threshold: number | null;
}

/** Configurable approval thresholds to detect structuring around */
const DEFAULT_THRESHOLDS = [1000, 2500, 5000, 10000, 25000, 50000, 100000];

/** Transactions within this many days from same vendor are clustered */
const TIME_WINDOW_DAYS = 7;

/** Cluster is flagged if combined amount exceeds the threshold by at most this ratio */
const THRESHOLD_BREACH_RATIO = 2.0;

/**
 * Split Invoice Detection (Structuring / Threshold Avoidance)
 *
 * Accounting basis: Employees with purchasing authority below a threshold
 * (e.g. $10,000) may split a single purchase into multiple invoices to
 * avoid triggering manager approval. Example: a $28,000 purchase split
 * into three $9,333 invoices submitted in the same week from the same vendor.
 *
 * Also known as "structuring" in AML contexts. When performed intentionally
 * to avoid controls, this constitutes misappropriation of assets.
 *
 * Detection method:
 * 1. Group by vendor + rolling 7-day window
 * 2. Find groups where each transaction is below a threshold
 *    but the combined total crosses it
 * 3. Flag the group if the individual transactions are suspiciously similar
 *    (within ±15% of each other — characteristic of deliberate splitting)
 *
 * Standard: ACFE Fraud Examiners Manual — Purchasing Schemes chapter.
 * PCAOB AS 2401.52 — evaluation of controls over approval authorization.
 * Threshold: configurable approval limits (defaults match ACFE examples).
 *
 * @param transactions - Full ledger being analyzed
 * @param thresholds - Approval authorization thresholds to test against
 * @returns Per-transaction split invoice flags
 */
export function detectSplitInvoices(
  transactions: RawTransaction[],
  thresholds: number[] = DEFAULT_THRESHOLDS
): SplitInvoiceResult[] {
  const results: SplitInvoiceResult[] = transactions.map(() => ({
    is_split_invoice: false,
    split_cluster_id: null,
    cluster_total: null,
    cluster_size: null,
    suspected_threshold: null,
  }));

  if (transactions.length < 2) return results;

  // Group by vendor
  const vendorGroups = new Map<string, number[]>();
  transactions.forEach((txn, idx) => {
    const vendor = txn.vendor.toLowerCase().trim();
    if (!vendorGroups.has(vendor)) vendorGroups.set(vendor, []);
    vendorGroups.get(vendor)!.push(idx);
  });

  let clusterCounter = 0;

  for (const [, vendorIndices] of vendorGroups.entries()) {
    if (vendorIndices.length < 2) continue;

    // Sort by date within vendor
    const sorted = vendorIndices
      .map((idx) => ({ idx, date: new Date(transactions[idx]!.date).getTime() }))
      .sort((a, b) => a.date - b.date);

    // Sliding window — find clusters within TIME_WINDOW_DAYS
    for (let i = 0; i < sorted.length - 1; i++) {
      const windowStart = sorted[i]!.date;
      const window: number[] = [sorted[i]!.idx];

      for (let j = i + 1; j < sorted.length; j++) {
        const daysDiff = (sorted[j]!.date - windowStart) / (1000 * 60 * 60 * 24);
        if (daysDiff <= TIME_WINDOW_DAYS) {
          window.push(sorted[j]!.idx);
        } else {
          break;
        }
      }

      if (window.length < 2) continue;

      const windowAmounts = window.map((idx) => transactions[idx]!.amount);
      const clusterTotal = windowAmounts.reduce((a, b) => a + b, 0);

      for (const threshold of thresholds) {
        // All individual transactions below threshold, but combined total crosses it
        const allBelow = windowAmounts.every((a) => a < threshold);
        const totalAbove = clusterTotal >= threshold;
        const notExcessivelyLarge = clusterTotal <= threshold * THRESHOLD_BREACH_RATIO;

        if (!allBelow || !totalAbove || !notExcessivelyLarge) continue;

        // Amounts should be "suspiciously similar" — within 15% of the max amount
        const maxAmt = Math.max(...windowAmounts);
        const allSimilar = windowAmounts.every((a) => Math.abs(a - maxAmt) / maxAmt <= 0.15);

        if (!allSimilar) continue;

        // Flag this cluster
        const clusterId = `SPLIT-${String(++clusterCounter).padStart(4, '0')}`;
        for (const idx of window) {
          const result = results[idx];
          if (result && !result.is_split_invoice) {
            result.is_split_invoice = true;
            result.split_cluster_id = clusterId;
            result.cluster_total = clusterTotal;
            result.cluster_size = window.length;
            result.suspected_threshold = threshold;
          }
        }

        break; // Only flag for the lowest matching threshold
      }
    }
  }

  return results;
}
