// lib/detector-info.ts
// ─────────────────────────────────────────────────────────────────
// Plain-English descriptions for each detector. Used in tooltips
// and the Excel export's "Explanations" tab.
// ─────────────────────────────────────────────────────────────────

import type { DetectorName } from './types/transaction';

export interface DetectorInfo {
  name: string;
  short: string;
  long: string;
  basis: string;
}

export const DETECTOR_INFO: Record<DetectorName, DetectorInfo> = {
  BENFORD_1ST: {
    name: "Benford's Law (1st digit)",
    short: 'Distribution of leading digits deviates from Benford expectations.',
    long: "Naturally occurring transaction data follows Benford's Law: digit 1 appears as the leading digit ~30% of the time, digit 9 only ~5%. Significant deviation from this pattern suggests fabricated or manipulated values.",
    basis: 'Nigrini, Benford\'s Law (2012); AICPA AU-C 240',
  },
  BENFORD_2ND: {
    name: "Benford's Law (2nd digit)",
    short: 'Second-digit distribution deviates from Benford expectations.',
    long: 'The second digit of naturally occurring values has a near-uniform but slightly decreasing distribution. Strong deviations often indicate threshold rounding or invented numbers.',
    basis: 'Nigrini, Benford\'s Law (2012)',
  },
  ROUND_NUMBER: {
    name: 'Round Number',
    short: 'Amount is a round number or sits just below an approval threshold.',
    long: 'Fabricated transactions disproportionately use round numbers ($5,000.00) or values just below approval thresholds ($9,990 to avoid a $10,000 limit). Genuine business transactions are rarely round.',
    basis: 'ACFE Fraud Examiners Manual',
  },
  ISOLATION_FOREST: {
    name: 'Isolation Forest',
    short: 'Transaction is statistically anomalous vs. the population.',
    long: 'An unsupervised machine-learning model that scores how easily a record can be "isolated" from the rest of the data. Outliers split off in fewer steps and receive higher anomaly scores.',
    basis: 'Liu, Ting & Zhou (2008)',
  },
  RSF: {
    name: 'Relative Size Factor',
    short: 'Transaction is unusually large for this vendor\'s typical amounts.',
    long: 'RSF = transaction amount ÷ vendor\'s median amount. RSF > 3.0 means the transaction is at least 3× the vendor\'s typical invoice — a classic signal of either keying error or inflated invoice.',
    basis: 'Nigrini, Forensic Analytics (2011)',
  },
  EXACT_DUPLICATE: {
    name: 'Exact Duplicate',
    short: 'Identical amount + vendor + date already exists.',
    long: 'Exact duplicates of vendor, amount, and date in the same period strongly suggest double-payment fraud or accidental duplicate entry.',
    basis: 'AICPA AU-C 240',
  },
  FUZZY_DUPLICATE: {
    name: 'Fuzzy Duplicate',
    short: 'Near-duplicate of another transaction (similar vendor name).',
    long: 'Levenshtein-distance matching catches duplicates where the vendor name has been slightly altered (e.g., "ACME Corp" vs "Acme Corp."). A common method for hiding double-payment.',
    basis: 'COSO Internal Control Framework',
  },
  SPLIT_INVOICE: {
    name: 'Split Invoice',
    short: 'Multiple smaller transactions cluster just under an approval threshold.',
    long: 'Splitting one large invoice into several smaller ones to evade managerial approval. Detected when 2+ same-vendor transactions on close dates sum near a known threshold ($1,000, $5,000, $10,000, etc.).',
    basis: 'ACFE 2024 Report to the Nations',
  },
  DESCRIPTION_AUDIT: {
    name: 'Description Audit',
    short: 'Description contains red-flag keywords.',
    long: 'Keyword scoring against a curated list (e.g., "miscellaneous", "consulting", "various", blank). Vague descriptions are common in shell-company schemes.',
    basis: 'ACFE Fraud Examiners Manual',
  },
  EDGAR_UNVERIFIED: {
    name: 'EDGAR Unverified',
    short: 'Vendor not found in SEC EDGAR registry.',
    long: 'Cross-checks vendor name against the SEC EDGAR company database. Public-company vendors that cannot be verified may be shell entities.',
    basis: 'SEC EDGAR public API',
  },
  OFAC_HIT: {
    name: 'OFAC Hit',
    short: 'Vendor matches an OFAC sanctions list entry.',
    long: 'US Treasury Office of Foreign Assets Control (OFAC) maintains lists of sanctioned individuals and entities. Any payment to an OFAC-listed party is a regulatory violation.',
    basis: 'OFAC SDN List',
  },
  ADDRESS_INVALID: {
    name: 'Address Invalid',
    short: 'Vendor address fails geocoding or resolves to a residential location.',
    long: 'Ghost vendors often use fake addresses, mail-drop services, or residential addresses (an employee\'s home). Nominatim geocoding flags these.',
    basis: 'ACFE Fraud Examiners Manual — Vendor Fraud',
  },
};
