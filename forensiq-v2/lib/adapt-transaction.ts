import type { AnalyzedTransaction, DetectorName } from './types/transaction';
import { DETECTOR_INFO } from './detector-info';

const DETECTOR_LABEL: Record<DetectorName, string> = {
  BENFORD_1ST: 'Benford',
  BENFORD_2ND: 'Benford 2',
  ROUND_NUMBER: 'Round #',
  ISOLATION_FOREST: 'Outlier',
  RSF: 'RSF',
  EXACT_DUPLICATE: 'Duplicate',
  FUZZY_DUPLICATE: 'Fuzzy Dup',
  SPLIT_INVOICE: 'Split',
  DESCRIPTION_AUDIT: 'Desc.',
  EDGAR_UNVERIFIED: 'EDGAR',
  OFAC_HIT: 'OFAC',
  ADDRESS_INVALID: 'Address',
};

const DRAWER_DETECTORS: DetectorName[] = [
  'EXACT_DUPLICATE', 'RSF', 'ISOLATION_FOREST', 'SPLIT_INVOICE',
  'ROUND_NUMBER', 'DESCRIPTION_AUDIT', 'BENFORD_1ST',
  'OFAC_HIT', 'EDGAR_UNVERIFIED', 'ADDRESS_INVALID',
];

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function getDetectorMessage(txn: AnalyzedTransaction, d: DetectorName): string {
  const triggered = txn.triggered_detectors.includes(d);
  switch (d) {
    case 'EXACT_DUPLICATE':
      return triggered
        ? 'Exact duplicate detected — same vendor, amount, and date.'
        : 'No exact duplicate found.';
    case 'RSF':
      return triggered
        ? `Amount is ${txn.rsf.toFixed(1)}× the median for this vendor.`
        : 'Amount is within normal range for this vendor.';
    case 'ISOLATION_FOREST':
      return triggered
        ? `Statistical outlier detected (score: ${txn.isolation_score.toFixed(0)}/100).`
        : 'Transaction is within expected distribution range.';
    case 'SPLIT_INVOICE':
      return triggered
        ? 'Possible invoice splitting — cluster of same-vendor transactions near approval threshold.'
        : 'No structuring pattern detected.';
    case 'BENFORD_1ST':
      return triggered
        ? `First digit (${txn.benford_first_digit}) deviates from Benford's Law.`
        : `First digit (${txn.benford_first_digit}) conforms to Benford's Law.`;
    case 'ROUND_NUMBER':
      return triggered
        ? 'Amount is suspiciously round or just below an approval threshold.'
        : 'No suspicious rounding detected.';
    case 'DESCRIPTION_AUDIT':
      return triggered
        ? `Description matched high-risk pattern (score: ${txn.description_risk.toFixed(0)}/100).`
        : 'Description appears specific and legitimate.';
    case 'OFAC_HIT':
      if (txn.ofac_hit === null) return 'OFAC screening not available for this vendor.';
      return triggered
        ? 'Vendor name matches an entry on the OFAC sanctions list — CRITICAL escalation.'
        : 'Vendor name does not match any OFAC SDN list entry.';
    case 'EDGAR_UNVERIFIED':
      if (txn.edgar_verified === null) return 'EDGAR verification not available for this vendor.';
      return triggered
        ? 'Vendor not found in SEC EDGAR registry — possible shell entity.'
        : 'Vendor confirmed in SEC EDGAR registry.';
    case 'ADDRESS_INVALID':
      if (txn.address_valid === null) return 'No address provided for geocoding.';
      return triggered
        ? 'Vendor address could not be geocoded or resolves to a residential location.'
        : 'Vendor address geocodes to a valid commercial location.';
    default:
      return DETECTOR_INFO[d].short;
  }
}

type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';

function toRiskLevel(tier: string): RiskLevel {
  const map: Record<string, RiskLevel> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  };
  return map[tier] ?? 'Low';
}

export interface TableTransaction {
  id: string;
  date: string;
  vendor: string;
  amount: string;
  risk: RiskLevel;
  score: number;
  detectors: string[];
  detectorResults: { name: string; description: string; status: 'PASS' | 'FAIL' | 'N/A' }[];
}

function detectorStatus(txn: AnalyzedTransaction, d: DetectorName): 'PASS' | 'FAIL' | 'N/A' {
  // External checks return null when the verification didn't run (e.g., over
  // the rate-limit cap, or no address provided). Show "N/A" rather than a
  // misleading PASS for those.
  if (d === 'OFAC_HIT' && txn.ofac_hit === null) return 'N/A';
  if (d === 'EDGAR_UNVERIFIED' && txn.edgar_verified === null) return 'N/A';
  if (d === 'ADDRESS_INVALID' && txn.address_valid === null) return 'N/A';
  return txn.triggered_detectors.includes(d) ? 'FAIL' : 'PASS';
}

export function adaptTransaction(txn: AnalyzedTransaction): TableTransaction {
  return {
    id: txn.invoice_id,
    date: txn.date,
    vendor: txn.vendor,
    amount: fmt(txn.amount),
    risk: toRiskLevel(txn.risk_tier),
    score: Math.round(txn.composite_risk),
    detectors: txn.triggered_detectors.map((d) => DETECTOR_LABEL[d] ?? d),
    detectorResults: DRAWER_DETECTORS.map((d) => ({
      name: DETECTOR_INFO[d].name,
      description: getDetectorMessage(txn, d),
      status: detectorStatus(txn, d),
    })),
  };
}
