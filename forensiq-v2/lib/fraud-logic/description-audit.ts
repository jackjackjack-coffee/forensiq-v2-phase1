// lib/fraud-logic/description-audit.ts
// ─────────────────────────────────────────────────────────────────
// Invoice description risk scoring — flags vague or generic descriptions
// commonly used to conceal fictitious or fraudulent transactions.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction } from '../types/transaction';

export interface DescriptionAuditResult {
  /** Risk score 0–100. Higher = more suspicious description. */
  description_risk: number;
  /** Matched risk keywords/patterns */
  triggered_keywords: string[];
}

// ── Risk keyword dictionary ───────────────────────────────────────
// Higher weight = stronger fraud signal on its own.
// Scoring is additive — multiple weak signals compound.

interface RiskPattern {
  pattern: RegExp;
  weight: number;    // Contribution to 0–100 risk score
  label: string;     // Human-readable match reason
}

const RISK_PATTERNS: RiskPattern[] = [
  // Vague generic terms — highest risk (classic billing fraud language)
  { pattern: /\bmisc(ellaneous)?\b/i,      weight: 35, label: 'vague: miscellaneous' },
  { pattern: /\bother\b/i,                  weight: 30, label: 'vague: other' },
  { pattern: /\bservices?\b$/i,             weight: 25, label: 'vague: services (only)' },
  { pattern: /\bconsulting\b$/i,            weight: 20, label: 'vague: consulting (only)' },
  { pattern: /\bfees?\b$/i,                 weight: 25, label: 'vague: fees (only)' },
  { pattern: /\bexpenses?\b$/i,             weight: 20, label: 'vague: expenses (only)' },
  { pattern: /\bgeneral\b/i,                weight: 15, label: 'vague: general' },
  { pattern: /\bvarious\b/i,                weight: 20, label: 'vague: various' },
  { pattern: /\bwork\s+performed\b/i,       weight: 20, label: 'vague: work performed' },
  { pattern: /\bprofessional\s+services?\b/i, weight: 15, label: 'vague: professional services' },
  { pattern: /\bmanagement\s+services?\b/i, weight: 20, label: 'vague: management services' },

  // Missing or minimal description
  { pattern: /^[-–—n\/a]+$/i,              weight: 45, label: 'empty: N/A placeholder' },
  { pattern: /^(tbd|tba|none|null)$/i,      weight: 45, label: 'empty: placeholder text' },

  // Numbers-only (no description at all)
  { pattern: /^\d+$/,                       weight: 50, label: 'empty: numeric only' },

  // High-risk categories when combined with large amounts
  { pattern: /\bgift\b/i,                   weight: 30, label: 'category: gift' },
  { pattern: /\bpersonal\b/i,               weight: 40, label: 'category: personal' },
  { pattern: /\bcash\s+advance\b/i,         weight: 50, label: 'category: cash advance' },
  { pattern: /\bloan\b/i,                   weight: 35, label: 'category: loan' },

  // Correction/adjustment language — may indicate post-hoc fabrication
  { pattern: /\badjust(ment)?\b/i,          weight: 20, label: 'journal: adjustment' },
  { pattern: /\bcorrect(ion)?\b/i,           weight: 15, label: 'journal: correction' },
  { pattern: /\bwrite[- ]?off\b/i,           weight: 25, label: 'journal: write-off' },
  { pattern: /\breclassif(y|ication)\b/i,   weight: 15, label: 'journal: reclassification' },
];

const EMPTY_DESCRIPTION_SCORE = 60; // No description at all

/**
 * Description Audit — Invoice Description Risk Scoring
 *
 * Accounting basis: Fraudulent invoices frequently use vague, generic,
 * or minimal descriptions that resist scrutiny. "Consulting Services,"
 * "Miscellaneous," and "Professional Fees" are the most common descriptions
 * found on fictitious vendor invoices in ACFE case studies.
 *
 * This detector flags invoices where the description provides insufficient
 * justification for the expenditure — a red flag for:
 * - Fictitious vendor schemes (shell company invoices)
 * - Ghost employee reimbursements
 * - Personal expenditures disguised as business expenses
 * - Journal entry fraud (adjustments with no supporting documentation)
 *
 * Scoring is additive: each matched pattern contributes to the 0–100 score.
 * Amount-weighting: a vague $500 invoice is low risk; a vague $500,000
 * invoice is high risk regardless of description quality.
 *
 * Standard: ACFE Fraud Examiners Manual — Document Examination chapter.
 * AICPA AU-C 240.A29 — obtaining an understanding of the entity's financial
 * reporting process including journal entries.
 *
 * @param transactions - Full ledger being analyzed
 * @returns Per-transaction description risk scores
 */
export function auditDescriptions(transactions: RawTransaction[]): DescriptionAuditResult[] {
  const amounts = transactions.map((t) => t.amount);
  const maxAmount = Math.max(...amounts, 1);
  const p75Amount = percentile(amounts, 0.75);

  return transactions.map((txn) => {
    const desc = (txn.description ?? '').trim();

    // Missing description: immediate base risk
    if (!desc) {
      const amount_multiplier = txn.amount > p75Amount ? 1.4 : 1.0;
      return {
        description_risk: Math.min(100, Math.round(EMPTY_DESCRIPTION_SCORE * amount_multiplier)),
        triggered_keywords: ['missing: no description provided'],
      };
    }

    // Match against risk patterns
    const triggered: string[] = [];
    let raw_score = 0;

    for (const rp of RISK_PATTERNS) {
      if (rp.pattern.test(desc)) {
        triggered.push(rp.label);
        raw_score += rp.weight;
      }
    }

    // Short description — increases risk proportionally
    if (desc.length < 5 && raw_score === 0) {
      triggered.push('length: very short description');
      raw_score += 20;
    }

    // Amount-weighting: high-amount + vague description = greater concern
    let score = raw_score;
    if (txn.amount > p75Amount && raw_score > 0) {
      score = Math.min(100, raw_score * 1.3);
    }
    if (txn.amount > maxAmount * 0.5 && raw_score > 0) {
      score = Math.min(100, score * 1.2);
    }

    return {
      description_risk: Math.min(100, Math.round(score)),
      triggered_keywords: triggered,
    };
  });
}

// ── Utility ───────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(p * sorted.length);
  return sorted[idx] ?? sorted[sorted.length - 1] ?? 0;
}
