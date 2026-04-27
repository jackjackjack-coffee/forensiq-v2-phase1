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

export interface ProgressUpdate {
  step: number;
  total: number;
  label: string;
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

  tick(9); await yieldToUI();
  const analyzedTransactions: AnalyzedTransaction[] = transactions.map((txn, i) =>
    assembleAnalyzedTransaction(txn, {
      isolation_score: risk_scores[i] ?? 0,
      is_outlier: is_outlier[i] ?? false,
      rsf: rsfResults[i] ?? { rsf: 1, rsf_flag: false, rsf_zscore: 0, vendor_median: txn.amount, vendor_count: 1 },
      duplicate: dupResults[i] ?? { is_exact_duplicate: false, dup_count: 1, dup_group_key: null },
      fuzzyDuplicate: fuzzyResults[i] ?? { fuzzy_dup_group: null, fuzzy_match_idx: null, fuzzy_distance: null },
      splitInvoice: splitResults[i] ?? { is_split_invoice: false, split_cluster_id: null, cluster_total: null, cluster_size: null, suspected_threshold: null },
      descriptionAudit: descResults[i] ?? { description_risk: 0, triggered_keywords: [] },
      is_round_number: roundFlags[i] ?? false,
      edgar_verified: null,
      ofac_hit: null,
      address_valid: null,
    })
  );

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
