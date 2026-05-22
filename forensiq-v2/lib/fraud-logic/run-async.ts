// lib/fraud-logic/run-async.ts
// ─────────────────────────────────────────────────────────────────
// Async wrapper around runForensicAnalysis that yields between
// detector layers so the UI can update progress and the browser
// stays responsive on large datasets.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction, AnalysisResult, AnalyzedTransaction } from '../types/transaction';
import { analyzeBenfordFirst, analyzeBenfordSecond, analyzeRoundNumbers } from './benford';
import { runIsolationForest } from './isolation-forest';
import { computeRsf } from './rsf';
import { detectExactDuplicates, detectFuzzyDuplicates } from './duplicate';
import { detectSplitInvoices } from './split-invoice';
import { auditDescriptions } from './description-audit';
import { assembleAnalyzedTransaction, computePortfolioRisk } from './composite-score';
import type { ExternalVerifyResponse } from '@/app/api/external-verify/route';

export interface ProgressUpdate {
  step: number;
  total: number;
  label: string;
}

/**
 * Runs the forensic analysis inside a dedicated Web Worker so the UI thread
 * stays responsive (no "page unresponsive" dialog on large datasets).
 * Falls back to `runForensicAnalysisAsync` if `Worker` is unavailable.
 */
export function runForensicAnalysisInWorker(
  transactions: RawTransaction[],
  onProgress?: (p: ProgressUpdate) => void,
): Promise<AnalysisResult> {
  if (typeof Worker === 'undefined') {
    return runForensicAnalysisAsync(transactions, onProgress);
  }
  return new Promise<AnalysisResult>((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url));
    const finish = (cb: () => void) => { try { worker.terminate(); } catch {} cb(); };
    worker.onmessage = (e: MessageEvent<
      | { type: 'progress'; step: number; total: number; label: string }
      | { type: 'done'; result: AnalysisResult }
      | { type: 'error'; error: string }
    >) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        onProgress?.({ step: msg.step, total: msg.total, label: msg.label });
      } else if (msg.type === 'done') {
        finish(() => resolve(msg.result));
      } else if (msg.type === 'error') {
        finish(() => reject(new Error(msg.error)));
      }
    };
    worker.onerror = (e) => {
      finish(() => reject(new Error(e.message || 'Worker error')));
    };
    worker.postMessage({ type: 'analyze', transactions });
  });
}

const ROUND_THRESHOLDS = [500, 1000, 2500, 5000, 9999, 10000, 25000, 50000, 100000];
function isJustBelowThresholdLocal(amount: number): boolean {
  return ROUND_THRESHOLDS.some((t) => amount < t && t - amount <= 15);
}

const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

export async function runForensicAnalysisAsync(
  transactions: RawTransaction[],
  onProgress?: (p: ProgressUpdate) => void
): Promise<AnalysisResult> {
  const STEPS = [
    "Benford's Law (1st digit)",
    "Benford's Law (2nd digit)",
    'Round number analysis',
    'Isolation forest (anomaly detection)',
    'Relative size factor',
    'Exact duplicates',
    'Fuzzy duplicates',
    'Split invoice clustering',
    'Description audit',
    'EDGAR vendor verification',
    'Address geocoding (Nominatim)',
    'Composite scoring',
  ];
  const total = STEPS.length;
  const tick = (i: number) => onProgress?.({ step: i + 1, total, label: STEPS[i]! });

  if (transactions.length === 0) {
    return buildEmptyResult();
  }

  tick(0); await yieldToUI();
  const benford_1st = analyzeBenfordFirst(transactions);

  tick(1); await yieldToUI();
  const benford_2nd = analyzeBenfordSecond(transactions);

  tick(2); await yieldToUI();
  const roundNumberSummary = analyzeRoundNumbers(transactions);
  const roundFlags = transactions.map(
    (t) => t.amount % 1000 === 0 || isJustBelowThresholdLocal(t.amount)
  );

  tick(3); await yieldToUI();
  const { risk_scores, is_outlier } = runIsolationForest(transactions, { contamination: 0.05 });

  tick(4); await yieldToUI();
  const rsfResults = computeRsf(transactions);

  tick(5); await yieldToUI();
  const dupResults = detectExactDuplicates(transactions);

  tick(6); await yieldToUI();
  const fuzzyResults = detectFuzzyDuplicates(transactions);

  tick(7); await yieldToUI();
  const splitResults = detectSplitInvoices(transactions);

  tick(8); await yieldToUI();
  const descResults = auditDescriptions(transactions);

  // ── External verification: EDGAR + Nominatim ─────────────────────
  // Collect unique vendors and their first-seen address (per vendor)
  const vendorToOriginal = new Map<string, string>(); // lowercase → original casing
  const vendorToAddress = new Map<string, string>();  // lowercase → address

  for (const txn of transactions) {
    const key = txn.vendor.toLowerCase();
    if (!vendorToOriginal.has(key)) {
      vendorToOriginal.set(key, txn.vendor);
    }
    if (txn.address && !vendorToAddress.has(key)) {
      vendorToAddress.set(key, txn.address);
    }
  }

  const uniqueVendors = [...vendorToOriginal.values()];
  const uniqueAddresses = [...new Set([...vendorToAddress.values()])];

  tick(9); await yieldToUI();

  let externalData: ExternalVerifyResponse = { edgar: {}, ofac: {}, nominatim: {} };
  try {
    const resp = await fetch('/api/external-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendors: uniqueVendors, addresses: uniqueAddresses }),
    });
    if (resp.ok) {
      externalData = (await resp.json()) as ExternalVerifyResponse;
    }
  } catch {
    // External verification unreachable — analysis continues with nulls
  }

  tick(10); await yieldToUI();

  // Build external_results Map keyed by lowercase vendor name
  const external_results = new Map<
    string,
    { edgar_verified: boolean | null; ofac_hit: boolean | null; address_valid: boolean | null }
  >();

  for (const [vendorLower, vendorOriginal] of vendorToOriginal) {
    const edgarResult = externalData.edgar[vendorOriginal];
    const ofacResult = externalData.ofac[vendorOriginal];
    const address = vendorToAddress.get(vendorLower);
    const nominatimResult = address != null ? externalData.nominatim[address] : undefined;

    external_results.set(vendorLower, {
      edgar_verified: edgarResult != null ? edgarResult.matched : null,
      ofac_hit: ofacResult != null ? ofacResult.hit : null,
      address_valid: nominatimResult != null ? nominatimResult.valid : null,
    });
  }

  tick(11); await yieldToUI();
  const analyzedTransactions: AnalyzedTransaction[] = transactions.map((txn, i) => {
    const extData = external_results.get(txn.vendor.toLowerCase()) ?? {
      edgar_verified: null,
      ofac_hit: null,
      address_valid: null,
    };
    return assembleAnalyzedTransaction(txn, {
      isolation_score: risk_scores[i] ?? 0,
      is_outlier: is_outlier[i] ?? false,
      rsf: rsfResults[i] ?? { rsf: 1, rsf_flag: false, rsf_zscore: 0, vendor_median: txn.amount, vendor_count: 1 },
      duplicate: dupResults[i] ?? { is_exact_duplicate: false, dup_count: 1, dup_group_key: null },
      fuzzyDuplicate: fuzzyResults[i] ?? { fuzzy_dup_group: null, fuzzy_match_idx: null, fuzzy_distance: null },
      splitInvoice: splitResults[i] ?? { is_split_invoice: false, split_cluster_id: null, cluster_total: null, cluster_size: null, suspected_threshold: null },
      descriptionAudit: descResults[i] ?? { description_risk: 0, triggered_keywords: [] },
      is_round_number: roundFlags[i] ?? false,
      edgar_verified: extData.edgar_verified,
      ofac_hit: extData.ofac_hit,
      address_valid: extData.address_valid,
    });
  });

  const portfolio = computePortfolioRisk(analyzedTransactions, benford_1st.mad);

  return {
    transactions: analyzedTransactions,
    benford_1st,
    benford_2nd,
    round_number: roundNumberSummary,
    portfolio,
  };
}

function buildEmptyResult(): AnalysisResult {
  return {
    transactions: [],
    benford_1st: { digit_position: 1, observed: {}, expected: {}, chi_square: 0, mad: 0, conformity: 'ACCEPTABLE', total_records: 0 },
    benford_2nd: { digit_position: 2, observed: {}, expected: {}, chi_square: 0, mad: 0, conformity: 'ACCEPTABLE', total_records: 0 },
    round_number: { round_count: 0, round_rate: 0, flagged: false, threshold_distribution: {} },
    portfolio: { score: 0, tier: 'LOW', outlier_rate: 0, rsf_flag_rate: 0, duplicate_rate: 0, benford_mad: 0, round_number_rate: 0, total_transactions: 0, flagged_transactions: 0, estimated_exposure: 0 },
  };
}
