// lib/types/transaction.ts
// ─────────────────────────────────────────────────────────────────
// All ForensiQ domain types live here. No exceptions.
// RULE: No `any`. External data enters as `unknown`, narrowed via type guards.
// ─────────────────────────────────────────────────────────────────

// ── Raw input shape (after CSV parse + column mapping) ───────────
export interface RawTransaction {
  invoice_id: string;
  date: string;           // ISO 8601 — YYYY-MM-DD
  vendor: string;
  category?: string;
  amount: number;         // Always positive. Strip negatives on parse.
  description?: string;
  approved_by?: string;
  address?: string;       // Vendor address — used for Nominatim geocoding
}

// ── Fully analyzed transaction (output of all detector layers) ───
export interface AnalyzedTransaction extends RawTransaction {
  // Layer 1 — Statistical Analysis
  benford_first_digit: number;
  benford_second_digit: number | null;  // null if amount < 10
  is_round_number: boolean;

  // Layer 2 — Transaction Pattern Analysis
  isolation_score: number;        // 0–100, higher = more suspicious
  is_outlier: boolean;
  rsf: number;                    // Relative Size Factor vs vendor median
  rsf_flag: boolean;              // true if RSF > 3.0
  rsf_zscore: number;
  is_exact_duplicate: boolean;
  dup_count: number;              // how many exact matches exist
  fuzzy_dup_group: string | null; // group ID if part of a fuzzy cluster
  is_split_invoice: boolean;

  // Layer 3 — Text & External Verification
  description_risk: number;       // 0–100
  edgar_verified: boolean | null; // null = not yet checked
  ofac_hit: boolean | null;
  address_valid: boolean | null;

  // Composite output
  composite_risk: number;         // 0–100
  risk_tier: RiskTier;
  triggered_detectors: DetectorName[];
}

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DetectorName =
  | 'BENFORD_1ST'
  | 'BENFORD_2ND'
  | 'ROUND_NUMBER'
  | 'ISOLATION_FOREST'
  | 'RSF'
  | 'EXACT_DUPLICATE'
  | 'FUZZY_DUPLICATE'
  | 'SPLIT_INVOICE'
  | 'DESCRIPTION_AUDIT'
  | 'EDGAR_UNVERIFIED'
  | 'OFAC_HIT'
  | 'ADDRESS_INVALID';

// ── Benford's Law result (portfolio-level) ────────────────────────
export interface BenfordResult {
  digit_position: 1 | 2;
  observed: Record<number, number>;   // digit → frequency %
  expected: Record<number, number>;   // digit → Benford % 
  chi_square: number;
  mad: number;                        // Mean Absolute Deviation
  conformity: 'ACCEPTABLE' | 'MARGINAL' | 'NON_CONFORMING';
  total_records: number;
}

// ── Round Number test result (portfolio-level) ────────────────────
export interface RoundNumberResult {
  round_count: number;
  round_rate: number;      // 0–1
  flagged: boolean;        // true if rate > 0.15
  threshold_distribution: Record<number, number>; // threshold → count
}

// ── Portfolio-level risk summary ──────────────────────────────────
export interface PortfolioRiskSummary {
  score: number;                   // 0–100
  tier: RiskTier;
  outlier_rate: number;            // 0–1
  rsf_flag_rate: number;           // 0–1
  duplicate_rate: number;          // 0–1
  benford_mad: number;
  round_number_rate: number;       // 0–1
  total_transactions: number;
  flagged_transactions: number;    // count with risk_tier HIGH or CRITICAL
  estimated_exposure: number;      // sum of flagged transaction amounts
}

// ── Full analysis result bundle ───────────────────────────────────
export interface AnalysisResult {
  transactions: AnalyzedTransaction[];
  benford_1st: BenfordResult;
  benford_2nd: BenfordResult;
  round_number: RoundNumberResult;
  portfolio: PortfolioRiskSummary;
}

// ── Column mapping (from upload screen) ──────────────────────────
export interface ColumnMapping {
  amount: string;
  date: string;
  vendor: string;
  invoice_id?: string;
  description?: string;
  category?: string;
  approved_by?: string;
  address?: string;
}

// ── CSV parse result ──────────────────────────────────────────────
export interface ParseResult {
  transactions: RawTransaction[];
  errors: ParseError[];
  skipped_rows: number;
}

export interface ParseError {
  row: number;
  field: string;
  message: string;
}

// ── External API response shapes ─────────────────────────────────
export interface EdgarSearchResult {
  cik: string;
  entity_name: string;
  matched: boolean;
  confidence: number;
}

export interface OfacCheckResult {
  vendor: string;
  hit: boolean;
  matched_name?: string;
  list_type?: string;
}

export interface NominatimResult {
  address: string;
  valid: boolean;
  lat?: number;
  lon?: number;
  address_type?: string;
}

// ── Type guards for external/unknown data ─────────────────────────
export function isRawTransaction(val: unknown): val is RawTransaction {
  if (typeof val !== 'object' || val === null) return false;
  const t = val as Record<string, unknown>;
  return (
    typeof t['invoice_id'] === 'string' &&
    typeof t['date'] === 'string' &&
    typeof t['vendor'] === 'string' &&
    typeof t['amount'] === 'number' &&
    t['amount'] > 0
  );
}

export function isRiskTier(val: unknown): val is RiskTier {
  return val === 'LOW' || val === 'MEDIUM' || val === 'HIGH' || val === 'CRITICAL';
}
