// lib/fraud-logic/benford.ts
// ─────────────────────────────────────────────────────────────────
// Benford's Law analysis for 1st and 2nd digit distributions.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction, BenfordResult, RoundNumberResult } from '../types/transaction';

// ── Precomputed Benford expected frequencies ──────────────────────

/**
 * Expected first-digit frequencies per Benford's Law.
 * P(d) = log₁₀(1 + 1/d)  for d ∈ {1..9}
 */
export const BENFORD_FIRST_EXPECTED: Record<number, number> = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => {
    const d = i + 1;
    return [d, Math.log10(1 + 1 / d) * 100];
  })
);

/**
 * Expected second-digit frequencies per Benford's Law.
 * P(d) = Σ_{k=1}^{9} log₁₀(1 + 1/(10k + d))  for d ∈ {0..9}
 */
export const BENFORD_SECOND_EXPECTED: Record<number, number> = Object.fromEntries(
  Array.from({ length: 10 }, (_, d) => {
    let prob = 0;
    for (let k = 1; k <= 9; k++) {
      prob += Math.log10(1 + 1 / (10 * k + d));
    }
    return [d, prob * 100];
  })
);

// ── First-digit extractor ─────────────────────────────────────────

function extractFirstDigit(amount: number): number | null {
  const str = String(Math.abs(amount)).replace('.', '').replace(/^0+/, '');
  const first = str[0];
  if (!first || !/[1-9]/.test(first)) return null;
  return parseInt(first, 10);
}

function extractSecondDigit(amount: number): number | null {
  const str = String(Math.abs(amount)).replace('.', '').replace(/^0+/, '');
  if (str.length < 2) return null;
  const second = str[1];
  if (second === undefined || !/[0-9]/.test(second)) return null;
  return parseInt(second, 10);
}

// ── Core Benford analysis ─────────────────────────────────────────

/**
 * Benford's Law — First Digit Analysis
 *
 * Accounting basis: Natural financial data (revenues, expenses, invoice amounts)
 * conforms to a logarithmic distribution of leading digits — "1" appears ~30.1%
 * of the time, "9" only ~4.6%. Fraudsters fabricating invoices tend to select
 * "random-looking" amounts, producing a uniform first-digit distribution.
 *
 * Red flags:
 * - Excess "9" frequency: amounts clustered just below approval thresholds
 *   ($9,999, $9,500) — classic "structuring" or "rounding down" scheme.
 * - Excess "1" frequency: may indicate overstatement at low dollar amounts.
 * - Deficit of "1": understatement — potential revenue suppression.
 *
 * Standard: ACFE Fraud Examiners Manual — Data Analysis chapter.
 * AICPA AU-C 240.A16 — use of analytical procedures to identify fraud risk.
 * Threshold: MAD < 6% = Acceptable; 6–10% = Marginal; > 10% = Non-Conforming.
 *
 * @param transactions - Full ledger being tested
 * @returns BenfordResult with observed/expected distributions and conformity assessment
 */
export function analyzeBenfordFirst(transactions: RawTransaction[]): BenfordResult {
  return analyzeBenford(transactions, 1);
}

/**
 * Benford's Law — Second Digit Analysis
 *
 * Accounting basis: The second digit test is more sensitive than the first for
 * detecting subtle manipulation. Fraudsters who are aware of Benford's first-digit
 * test may inadvertently produce non-conforming second-digit patterns.
 *
 * Particularly effective for detecting:
 * - Rounding to nearest hundred ($X00 endings)
 * - "Psychologically round" amounts used by human forgers
 *
 * Standard: Nigrini (2012) — Benford's Law: Applications for Forensic Accounting,
 * Auditing, and Fraud Detection. Wiley.
 * Threshold: Same MAD scale as first-digit test.
 *
 * @param transactions - Full ledger being tested
 * @returns BenfordResult for second-digit distribution
 */
export function analyzeBenfordSecond(transactions: RawTransaction[]): BenfordResult {
  return analyzeBenford(transactions, 2);
}

function analyzeBenford(transactions: RawTransaction[], position: 1 | 2): BenfordResult {
  const expected = position === 1 ? BENFORD_FIRST_EXPECTED : BENFORD_SECOND_EXPECTED;
  const digitRange = position === 1 ? range(1, 9) : range(0, 9);

  // Count observed digits
  const counts: Record<number, number> = Object.fromEntries(digitRange.map((d) => [d, 0]));
  let total = 0;

  for (const txn of transactions) {
    const digit = position === 1 ? extractFirstDigit(txn.amount) : extractSecondDigit(txn.amount);
    if (digit !== null && digit in counts) {
      counts[digit]++;
      total++;
    }
  }

  if (total === 0) {
    return {
      digit_position: position,
      observed: Object.fromEntries(digitRange.map((d) => [d, 0])),
      expected,
      chi_square: 0,
      mad: 0,
      conformity: 'ACCEPTABLE',
      total_records: 0,
    };
  }

  // Compute observed frequencies (%)
  const observed: Record<number, number> = Object.fromEntries(
    digitRange.map((d) => [d, (counts[d] / total) * 100])
  );

  // Chi-square statistic
  const chi_square = digitRange.reduce((sum, d) => {
    const obs = observed[d];
    const exp = expected[d];
    return sum + (exp > 0 ? Math.pow(obs - exp, 2) / exp : 0);
  }, 0);

  // Mean Absolute Deviation — emitted as a decimal fraction (0.0–1.0)
  // to match Nigrini's conventional units (MAD < 0.015 ≈ acceptable).
  const madPctPoints =
    digitRange.reduce((sum, d) => sum + Math.abs(observed[d] - expected[d]), 0) /
    digitRange.length;
  const mad = madPctPoints / 100;

  // Nigrini's MAD conformity ranges differ by digit position.
  // 1st digit: acceptable < 0.012, marginal < 0.015, else non-conforming.
  // 2nd digit: acceptable < 0.010, marginal < 0.012, else non-conforming.
  const acceptCutoff   = position === 1 ? 0.012 : 0.010;
  const marginalCutoff = position === 1 ? 0.015 : 0.012;
  const conformity =
    mad < acceptCutoff   ? 'ACCEPTABLE'  :
    mad < marginalCutoff ? 'MARGINAL'    : 'NON_CONFORMING';

  return {
    digit_position: position,
    observed,
    expected,
    chi_square,
    mad,
    conformity,
    total_records: total,
  };
}

// ── Per-transaction digit extraction ─────────────────────────────

/**
 * Extracts the 1st and 2nd Benford digits for a single transaction.
 * Used when building AnalyzedTransaction records.
 */
export function extractBenfordDigits(amount: number): {
  first: number;
  second: number | null;
} {
  return {
    first: extractFirstDigit(amount) ?? 1,
    second: extractSecondDigit(amount),
  };
}

// ── Round Number Test ─────────────────────────────────────────────

/** Approval thresholds monitored for structuring / rounding-down schemes */
const ROUND_THRESHOLDS = [500, 1000, 2500, 5000, 9999, 10000, 25000, 50000, 100000];

/**
 * Round Number Test
 *
 * Accounting basis: Naturally occurring invoice amounts are unlikely to end
 * in three or more zeros. A high frequency of round amounts (e.g. $1,000.00,
 * $5,000.00) suggests human selection rather than organic business activity.
 * This is especially suspicious when combined with amounts just below
 * common approval thresholds (e.g. $9,999 instead of $10,000).
 *
 * Also detects "structuring" — deliberately keeping amounts below reporting
 * or approval thresholds to avoid detection. Common in:
 * - Fictitious vendor schemes
 * - Expense reimbursement fraud
 * - Purchasing card (P-card) misuse
 *
 * Standard: ACFE Fraud Examiners Manual — Skimming and Cash Larceny chapter.
 * PCAOB AS 2401.66 — evaluation of misstatement patterns.
 * Threshold: > 15% of transactions ending in 000 is flagged.
 *
 * @param transactions - Full ledger being tested
 * @returns RoundNumberResult with rate and threshold breakdown
 */
export function analyzeRoundNumbers(transactions: RawTransaction[]): RoundNumberResult {
  if (transactions.length === 0) {
    return {
      round_count: 0,
      round_rate: 0,
      flagged: false,
      threshold_distribution: {},
    };
  }

  // "Round" = ends in 000 (i.e. divisible by 1000 with no cents)
  const roundTransactions = transactions.filter(
    (t) => t.amount % 1000 === 0 || isJustBelowThreshold(t.amount)
  );

  const threshold_distribution: Record<number, number> = {};
  for (const threshold of ROUND_THRESHOLDS) {
    const count = transactions.filter((t) => Math.abs(t.amount - threshold) <= 15).length;
    if (count > 0) threshold_distribution[threshold] = count;
  }

  const round_count = roundTransactions.length;
  const round_rate = round_count / transactions.length;

  return {
    round_count,
    round_rate,
    flagged: round_rate > 0.15,
    threshold_distribution,
  };
}

/**
 * Returns true if an amount is within $15 of a known approval threshold —
 * the classic "rounding down" fraud pattern.
 */
export function isJustBelowThreshold(amount: number): boolean {
  return ROUND_THRESHOLDS.some(
    (threshold) => amount < threshold && threshold - amount <= 15
  );
}

// ── Utility ───────────────────────────────────────────────────────

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
