// lib/fraud-logic/composite-score.ts
// ─────────────────────────────────────────────────────────────────
// Combines all detector signals into a 0–100 composite risk score
// and assigns risk tiers per ACFE escalation standards.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type {
  RawTransaction,
  AnalyzedTransaction,
  RiskTier,
  DetectorName,
  PortfolioRiskSummary,
} from '../types/transaction';
import type { RsfResult } from './rsf';
import type { DuplicateResult, FuzzyDuplicateResult } from './duplicate';
import type { SplitInvoiceResult } from './split-invoice';
import type { DescriptionAuditResult } from './description-audit';
import { extractBenfordDigits, isJustBelowThreshold } from './benford';

// ── Detector weights (must sum to 100) ───────────────────────────
// Rationale: IF and RSF carry highest weight as they are ML/quantitative
// methods with low false positive rates. Duplicates are definitive when
// flagged. Benford and description audit are portfolio-level signals
// that add weight when other flags are already present.

const WEIGHTS = {
  ISOLATION_FOREST: 30,    // ML anomaly score (continuous, highest signal)
  RSF: 25,                 // Vendor-normalized amount (highly specific)
  EXACT_DUPLICATE: 20,     // Binary — near-certain fraud when triggered
  SPLIT_INVOICE: 10,       // Pattern detection (medium confidence)
  DESCRIPTION_AUDIT: 8,    // Text analysis (supplementary)
  FUZZY_DUPLICATE: 5,      // Low weight — higher false positive rate
  ROUND_NUMBER: 2,         // Weak individual signal, useful in aggregate
} as const;

// ── Risk tier boundaries ──────────────────────────────────────────

function scoreToTier(score: number): RiskTier {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

// ── Per-transaction composite assembly ───────────────────────────

export interface CompositeInputs {
  isolation_score: number;       // 0–100
  is_outlier: boolean;
  rsf: RsfResult;
  duplicate: DuplicateResult;
  fuzzyDuplicate: FuzzyDuplicateResult;
  splitInvoice: SplitInvoiceResult;
  descriptionAudit: DescriptionAuditResult;
  is_round_number: boolean;
  // External verification (may be null if not yet checked)
  edgar_verified: boolean | null;
  ofac_hit: boolean | null;
  address_valid: boolean | null;
}

/**
 * Composite Risk Score — Combining All Forensic Detector Signals
 *
 * Accounting basis: No single analytical procedure is sufficient to conclude
 * fraud. AICPA AU-C 240 requires auditors to consider multiple risk factors
 * in combination. This composite score implements a weighted signal aggregation
 * across all four ACFE fraud indicator categories:
 *   1. Statistical anomalies (Benford, Round Number)
 *   2. Amount outliers (Isolation Forest, RSF)
 *   3. Payment patterns (Duplicate, Split Invoice)
 *   4. Documentation quality (Description Audit)
 *
 * Scoring is additive, not multiplicative. A single CRITICAL signal (e.g.
 * OFAC hit) overrides the numeric score to ensure automatic escalation.
 *
 * Standard: AICPA AU-C 240.25 — risk assessment for material misstatement
 * due to fraud. PCAOB AS 2401.68 — evaluating the results of audit procedures.
 *
 * @param txn     - Raw transaction being scored
 * @param inputs  - Pre-computed detector outputs for this transaction
 * @returns Composite risk score (0–100) and triggered detector list
 */
export function computeCompositeScore(
  txn: RawTransaction,
  inputs: CompositeInputs
): { composite_risk: number; risk_tier: RiskTier; triggered_detectors: DetectorName[] } {
  const triggered: DetectorName[] = [];
  let score = 0;

  // ── Isolation Forest (30% weight) ────────────────────────────
  score += (inputs.isolation_score / 100) * WEIGHTS.ISOLATION_FOREST;
  if (inputs.is_outlier) triggered.push('ISOLATION_FOREST');

  // ── RSF (25% weight) ─────────────────────────────────────────
  if (inputs.rsf.rsf_flag) {
    // Scale RSF contribution: RSF=3 → 50%, RSF=10 → 100% of weight
    const rsf_intensity = Math.min(1, (inputs.rsf.rsf - 3) / 7 + 0.5);
    score += rsf_intensity * WEIGHTS.RSF;
    triggered.push('RSF');
  } else if (inputs.rsf.rsf > 2.0) {
    // Sub-threshold RSF still contributes partially
    score += ((inputs.rsf.rsf - 2.0) / 1.0) * (WEIGHTS.RSF * 0.3);
  }

  // ── Exact Duplicate (20% weight) ─────────────────────────────
  if (inputs.duplicate.is_exact_duplicate) {
    score += WEIGHTS.EXACT_DUPLICATE;
    triggered.push('EXACT_DUPLICATE');
  }

  // ── Split Invoice (10% weight) ────────────────────────────────
  if (inputs.splitInvoice.is_split_invoice) {
    score += WEIGHTS.SPLIT_INVOICE;
    triggered.push('SPLIT_INVOICE');
  }

  // ── Description Audit (8% weight) ────────────────────────────
  score += (inputs.descriptionAudit.description_risk / 100) * WEIGHTS.DESCRIPTION_AUDIT;
  if (inputs.descriptionAudit.description_risk >= 30) {
    triggered.push('DESCRIPTION_AUDIT');
  }

  // ── Fuzzy Duplicate (5% weight) ──────────────────────────────
  if (inputs.fuzzyDuplicate.fuzzy_dup_group !== null) {
    score += WEIGHTS.FUZZY_DUPLICATE;
    triggered.push('FUZZY_DUPLICATE');
  }

  // ── Round Number (2% weight) ──────────────────────────────────
  if (inputs.is_round_number) {
    score += WEIGHTS.ROUND_NUMBER;
    triggered.push('ROUND_NUMBER');
  }

  // ── Benford-adjacent round-number signal ──────────────────────
  if (isJustBelowThreshold(txn.amount)) {
    score = Math.min(100, score + 8);
    if (!triggered.includes('ROUND_NUMBER')) triggered.push('ROUND_NUMBER');
  }

  // ── External verification — overrides (binary, non-weighted) ──
  if (inputs.ofac_hit === true) {
    score = 100; // OFAC match is immediate CRITICAL escalation
    triggered.push('OFAC_HIT');
  }
  if (inputs.edgar_verified === false && inputs.rsf.rsf_flag) {
    score = Math.min(100, score + 15); // Unverified vendor + large invoice
    triggered.push('EDGAR_UNVERIFIED');
  }
  if (inputs.address_valid === false) {
    score = Math.min(100, score + 10);
    triggered.push('ADDRESS_INVALID');
  }

  const composite_risk = Math.min(100, Math.round(score));
  const risk_tier = scoreToTier(composite_risk);

  return { composite_risk, risk_tier, triggered_detectors: triggered };
}

// ── Full transaction assembly ─────────────────────────────────────

/**
 * Assemble a complete AnalyzedTransaction from raw inputs + all detector outputs.
 */
export function assembleAnalyzedTransaction(
  txn: RawTransaction,
  inputs: CompositeInputs
): AnalyzedTransaction {
  const { composite_risk, risk_tier, triggered_detectors } = computeCompositeScore(txn, inputs);
  const benfordDigits = extractBenfordDigits(txn.amount);

  return {
    ...txn,
    benford_first_digit: benfordDigits.first,
    benford_second_digit: benfordDigits.second,
    is_round_number: inputs.is_round_number,

    isolation_score: inputs.isolation_score,
    is_outlier: inputs.is_outlier,
    rsf: inputs.rsf.rsf,
    rsf_flag: inputs.rsf.rsf_flag,
    rsf_zscore: inputs.rsf.rsf_zscore,

    is_exact_duplicate: inputs.duplicate.is_exact_duplicate,
    dup_count: inputs.duplicate.dup_count,
    fuzzy_dup_group: inputs.fuzzyDuplicate.fuzzy_dup_group,
    is_split_invoice: inputs.splitInvoice.is_split_invoice,

    description_risk: inputs.descriptionAudit.description_risk,
    edgar_verified: inputs.edgar_verified,
    ofac_hit: inputs.ofac_hit,
    address_valid: inputs.address_valid,

    composite_risk,
    risk_tier,
    triggered_detectors,
  };
}

// ── Portfolio-level summary ───────────────────────────────────────

/**
 * Compute portfolio-level risk summary from all analyzed transactions.
 *
 * Accounting basis: Portfolio risk is not the average of individual scores —
 * a single CRITICAL exception warrants engagement-level escalation per
 * AICPA AU-C 240.36 (auditor's communication of significant fraud risks).
 *
 * @param analyzed - All analyzed transactions
 * @param benford_mad - Mean Absolute Deviation from Benford analysis
 * @returns Portfolio-level risk summary
 */
export function computePortfolioRisk(
  analyzed: AnalyzedTransaction[],
  benford_mad: number
): PortfolioRiskSummary {
  const n = analyzed.length;
  if (n === 0) {
    return {
      score: 0, tier: 'LOW',
      outlier_rate: 0, rsf_flag_rate: 0, duplicate_rate: 0,
      benford_mad: 0, round_number_rate: 0,
      total_transactions: 0, flagged_transactions: 0, estimated_exposure: 0,
    };
  }

  const outlier_rate     = analyzed.filter((t) => t.is_outlier).length / n;
  const rsf_flag_rate    = analyzed.filter((t) => t.rsf_flag).length / n;
  const duplicate_rate   = analyzed.filter((t) => t.is_exact_duplicate).length / n;
  const round_number_rate = analyzed.filter((t) => t.is_round_number).length / n;

  // Portfolio score (mirrors v1 weighting, updated for v2 signals)
  const score = Math.min(
    100,
    Math.min(outlier_rate * 100 * 2, 30) +
    Math.min(rsf_flag_rate * 100 * 1.5, 25) +
    Math.min(duplicate_rate * 100 * 3, 25) +
    Math.min(benford_mad * 2, 20)
  );

  const flagged = analyzed.filter(
    (t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL'
  );

  return {
    score: Math.round(score),
    tier: scoreToTier(score),
    outlier_rate,
    rsf_flag_rate,
    duplicate_rate,
    benford_mad,
    round_number_rate,
    total_transactions: n,
    flagged_transactions: flagged.length,
    estimated_exposure: flagged.reduce((sum, t) => sum + t.amount, 0),
  };
}
