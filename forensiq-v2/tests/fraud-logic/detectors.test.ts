// tests/fraud-logic/detectors.test.ts
// ─────────────────────────────────────────────────────────────────
// Unit tests for ForensiQ v2 fraud detectors.
// Fixture: sample_invoices_labeled.csv fraud patterns from v1.
//
// Run with: npx jest tests/fraud-logic/
// ─────────────────────────────────────────────────────────────────

import {
  analyzeBenfordFirst,
  analyzeBenfordSecond,
  analyzeRoundNumbers,
} from '../../lib/fraud-logic/benford';
import { runIsolationForest } from '../../lib/fraud-logic/isolation-forest';
import { computeRsf } from '../../lib/fraud-logic/rsf';
import { detectExactDuplicates, detectFuzzyDuplicates, levenshtein } from '../../lib/fraud-logic/duplicate';
import { detectSplitInvoices } from '../../lib/fraud-logic/split-invoice';
import { auditDescriptions } from '../../lib/fraud-logic/description-audit';
import { computePortfolioRisk, assembleAnalyzedTransaction } from '../../lib/fraud-logic/composite-score';
import { runForensicAnalysis } from '../../lib/fraud-logic/index';
import type { RawTransaction } from '../../lib/types/transaction';

// ── Test fixtures ─────────────────────────────────────────────────

/** Generates naturally-distributed transactions that should conform to Benford's Law */
function makeLognormalTransactions(n: number, seed: number = 42): RawTransaction[] {
  const transactions: RawTransaction[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
  const boxMuller = () => Math.sqrt(-2 * Math.log(rand() + 1e-10)) * Math.cos(2 * Math.PI * rand());

  for (let i = 0; i < n; i++) {
    const logAmount = 9 + boxMuller() * 1.2; // ~$5k–$50k range
    transactions.push({
      invoice_id: `INV-${i}`,
      date: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
      vendor: `Vendor-${(i % 10) + 1}`,
      amount: Math.max(1, Math.exp(logAmount)),
    });
  }
  return transactions;
}

/** Legitimate vendor baseline — multiple transactions around $5k */
function makeVendorBaseline(vendor: string, count: number, baseline: number): RawTransaction[] {
  return Array.from({ length: count }, (_, i) => ({
    invoice_id: `INV-BASE-${vendor}-${i}`,
    date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
    vendor,
    amount: baseline + (Math.random() * 500 - 250), // ±$250 variance
  }));
}

// ── ─────────────────────────────────────────────────────────────────
//  1. BENFORD'S LAW TESTS
// ────────────────────────────────────────────────────────────────────

describe("Benford's Law — First Digit", () => {
  test('natural lognormal data should be ACCEPTABLE conformity', () => {
    const txns = makeLognormalTransactions(1000);
    const result = analyzeBenfordFirst(txns);

    expect(result.digit_position).toBe(1);
    expect(result.total_records).toBe(1000);
    expect(result.conformity).toBe('ACCEPTABLE');
    expect(result.mad).toBeLessThan(6);
  });

  test('uniform distribution (fabricated data) should be NON_CONFORMING', () => {
    // Fabricated: equal count of each first digit — highly non-Benford
    const txns: RawTransaction[] = [];
    for (let d = 1; d <= 9; d++) {
      for (let i = 0; i < 100; i++) {
        txns.push({
          invoice_id: `INV-${d}-${i}`,
          date: '2024-01-01',
          vendor: 'Test Vendor',
          amount: d * 10000 + i,
        });
      }
    }
    const result = analyzeBenfordFirst(txns);
    expect(result.conformity).toBe('NON_CONFORMING');
    expect(result.mad).toBeGreaterThan(10);
  });

  test('digit 1 should be most frequent in natural data (>25%)', () => {
    const txns = makeLognormalTransactions(500);
    const result = analyzeBenfordFirst(txns);
    expect(result.observed[1]).toBeGreaterThan(25);
  });

  test('expected frequencies match Benford formula', () => {
    const result = analyzeBenfordFirst(makeLognormalTransactions(10));
    // Digit 1: ~30.1%, Digit 9: ~4.6%
    expect(result.expected[1]).toBeCloseTo(30.103, 1);
    expect(result.expected[9]).toBeCloseTo(4.576, 1);
  });

  test('handles empty transaction array', () => {
    const result = analyzeBenfordFirst([]);
    expect(result.total_records).toBe(0);
    expect(result.conformity).toBe('ACCEPTABLE');
  });
});

describe("Benford's Law — Second Digit", () => {
  test('digit_position should be 2', () => {
    const result = analyzeBenfordSecond(makeLognormalTransactions(500));
    expect(result.digit_position).toBe(2);
  });

  test('expected second digit 0 is most frequent (~12%)', () => {
    const result = analyzeBenfordSecond(makeLognormalTransactions(10));
    expect(result.expected[0]).toBeGreaterThan(11);
    expect(result.expected[0]).toBeLessThan(13);
  });

  test('excludes single-digit amounts from second digit analysis', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-1', date: '2024-01-01', vendor: 'V', amount: 5 },    // single digit
      { invoice_id: 'INV-2', date: '2024-01-01', vendor: 'V', amount: 123 },  // has 2nd digit
    ];
    const result = analyzeBenfordSecond(txns);
    expect(result.total_records).toBe(1); // only the 3-digit amount
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  2. ROUND NUMBER TEST
// ────────────────────────────────────────────────────────────────────

describe('Round Number Test', () => {
  test('flags dataset with high round-number rate (>15%)', () => {
    const txns: RawTransaction[] = [
      ...Array.from({ length: 20 }, (_, i) => ({
        invoice_id: `INV-R-${i}`,
        date: '2024-01-01',
        vendor: 'V',
        amount: (i + 1) * 1000, // all round numbers
      })),
      ...makeLognormalTransactions(80), // mixed normal
    ];
    const result = analyzeRoundNumbers(txns);
    expect(result.flagged).toBe(true);
    expect(result.round_count).toBeGreaterThanOrEqual(20);
  });

  test('detects just-below-threshold amounts (structuring)', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-S1', date: '2024-01-01', vendor: 'V', amount: 9998 }, // $2 below $10k
      { invoice_id: 'INV-S2', date: '2024-01-01', vendor: 'V', amount: 4999 }, // $1 below $5k
    ];
    const result = analyzeRoundNumbers(txns);
    expect(result.round_count).toBe(2);
  });

  test('natural data should not be flagged', () => {
    const txns = makeLognormalTransactions(200);
    const result = analyzeRoundNumbers(txns);
    expect(result.round_rate).toBeLessThan(0.15);
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  3. ISOLATION FOREST
// ────────────────────────────────────────────────────────────────────

describe('Isolation Forest', () => {
  test('returns same number of scores as input transactions', () => {
    const txns = makeLognormalTransactions(100);
    const result = runIsolationForest(txns);
    expect(result.risk_scores.length).toBe(100);
    expect(result.is_outlier.length).toBe(100);
  });

  test('all risk scores are in 0–100 range', () => {
    const txns = makeLognormalTransactions(200);
    const result = runIsolationForest(txns);
    result.risk_scores.forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  test('extremely large payment is flagged as outlier', () => {
    const txns = makeLognormalTransactions(100);
    // Inject a $750,000 payment among $5k–$50k normal transactions
    const injected: RawTransaction = {
      invoice_id: 'INV-FRAUD',
      date: '2024-06-01',
      vendor: 'Alpha Business Services LLC',
      amount: 750_000,
    };
    txns.push(injected);

    const result = runIsolationForest(txns, { contamination: 0.05 });
    const injectedIdx = txns.length - 1;

    // The injected outlier should have a high risk score
    expect(result.risk_scores[injectedIdx]).toBeGreaterThan(70);
  });

  test('outlier rate approximates contamination parameter', () => {
    const txns = makeLognormalTransactions(200);
    const result = runIsolationForest(txns, { contamination: 0.05 });
    const outlierRate = result.is_outlier.filter(Boolean).length / txns.length;
    // Should be within 3% of target contamination rate
    expect(Math.abs(outlierRate - 0.05)).toBeLessThan(0.03);
  });

  test('handles single transaction without crashing', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-1', date: '2024-01-01', vendor: 'V', amount: 1000,
    }];
    const result = runIsolationForest(txns);
    expect(result.risk_scores.length).toBe(1);
  });

  test('deterministic — same input produces same output', () => {
    const txns = makeLognormalTransactions(100);
    const r1 = runIsolationForest(txns, { random_seed: 42 });
    const r2 = runIsolationForest(txns, { random_seed: 42 });
    expect(r1.risk_scores).toEqual(r2.risk_scores);
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  4. RSF ANALYSIS
// ────────────────────────────────────────────────────────────────────

describe('RSF Analysis', () => {
  test('returns same length as input', () => {
    const txns = makeLognormalTransactions(50);
    const results = computeRsf(txns);
    expect(results.length).toBe(50);
  });

  test('flags transaction at 10× vendor median (RSF=10)', () => {
    const vendor = 'Delta Management Group';
    const baseline = makeVendorBaseline(vendor, 15, 5000); // ~$5k median
    const fraudInvoice: RawTransaction = {
      invoice_id: 'INV-FRAUD',
      date: '2024-09-15',
      vendor,
      amount: 75_000, // 15× median
    };
    const all = [...baseline, fraudInvoice];
    const results = computeRsf(all);

    const fraudResult = results[all.length - 1];
    expect(fraudResult?.rsf_flag).toBe(true);
    expect(fraudResult?.rsf).toBeGreaterThan(10);
  });

  test('does not flag transaction within 3× median (RSF=2.5)', () => {
    const vendor = 'Normal Vendor';
    const baseline = makeVendorBaseline(vendor, 10, 10_000);
    const normalInvoice: RawTransaction = {
      invoice_id: 'INV-NORM',
      date: '2024-06-01',
      vendor,
      amount: 22_000, // 2.2× median — below 3.0 threshold
    };
    const all = [...baseline, normalInvoice];
    const results = computeRsf(all);

    const normalResult = results[all.length - 1];
    expect(normalResult?.rsf_flag).toBe(false);
  });

  test('single-transaction vendor has RSF of 1', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-SOLO',
      date: '2024-01-01',
      vendor: 'One-Time Vendor',
      amount: 50_000,
    }];
    const results = computeRsf(txns);
    expect(results[0]?.rsf).toBe(1);
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  5. DUPLICATE DETECTION
// ────────────────────────────────────────────────────────────────────

describe('Exact Duplicate Detection', () => {
  test('flags both transactions in a duplicate pair', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-1042', date: '2024-03-15', vendor: 'Meridian IT Solutions', amount: 12_450 },
      { invoice_id: 'INV-1178', date: '2024-03-15', vendor: 'Meridian IT Solutions', amount: 12_450 },
      { invoice_id: 'INV-9999', date: '2024-03-16', vendor: 'Meridian IT Solutions', amount: 12_450 },
    ];
    const results = detectExactDuplicates(txns);

    expect(results[0]?.is_exact_duplicate).toBe(true);
    expect(results[1]?.is_exact_duplicate).toBe(true);
    expect(results[2]?.is_exact_duplicate).toBe(false); // different date
  });

  test('dup_count reflects cluster size', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'A', date: '2024-01-01', vendor: 'V', amount: 1000 },
      { invoice_id: 'B', date: '2024-01-01', vendor: 'V', amount: 1000 },
      { invoice_id: 'C', date: '2024-01-01', vendor: 'V', amount: 1000 },
    ];
    const results = detectExactDuplicates(txns);
    expect(results[0]?.dup_count).toBe(3);
  });

  test('vendor name matching is case-insensitive and whitespace-normalized', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'A', date: '2024-01-01', vendor: 'ACME Corp', amount: 5000 },
      { invoice_id: 'B', date: '2024-01-01', vendor: 'acme corp', amount: 5000 },
    ];
    const results = detectExactDuplicates(txns);
    expect(results[0]?.is_exact_duplicate).toBe(true);
    expect(results[1]?.is_exact_duplicate).toBe(true);
  });

  test('different amounts from same vendor/date are not duplicates', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'A', date: '2024-01-01', vendor: 'V', amount: 1000 },
      { invoice_id: 'B', date: '2024-01-01', vendor: 'V', amount: 1001 },
    ];
    const results = detectExactDuplicates(txns);
    expect(results[0]?.is_exact_duplicate).toBe(false);
    expect(results[1]?.is_exact_duplicate).toBe(false);
  });
});

describe('Levenshtein Distance', () => {
  test('identical strings return 0', () => {
    expect(levenshtein('meridian it', 'meridian it')).toBe(0);
  });

  test('single substitution returns 1', () => {
    expect(levenshtein('meridan it', 'meridian it')).toBe(1);
  });

  test('completely different strings return high distance', () => {
    expect(levenshtein('apple', 'orange')).toBeGreaterThan(3);
  });
});

describe('Fuzzy Duplicate Detection', () => {
  test('flags vendor name with one-character typo', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-001', date: '2024-01-01', vendor: 'Meridian IT', amount: 5000 },
      { invoice_id: 'INV-002', date: '2024-01-01', vendor: 'Meridan IT', amount: 5000 }, // typo
    ];
    const results = detectFuzzyDuplicates(txns);
    const hasAnyFuzzy = results.some((r) => r.fuzzy_dup_group !== null);
    expect(hasAnyFuzzy).toBe(true);
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  6. SPLIT INVOICE DETECTION
// ────────────────────────────────────────────────────────────────────

describe('Split Invoice Detection', () => {
  test('detects three invoices splitting a $28k purchase below $10k threshold', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-A', date: '2024-06-01', vendor: 'OfficeMax', amount: 9_333 },
      { invoice_id: 'INV-B', date: '2024-06-03', vendor: 'OfficeMax', amount: 9_333 },
      { invoice_id: 'INV-C', date: '2024-06-05', vendor: 'OfficeMax', amount: 9_334 },
    ];
    const results = detectSplitInvoices(txns, [10_000]);
    const flagged = results.filter((r) => r.is_split_invoice);
    expect(flagged.length).toBe(3);
    expect(flagged[0]?.cluster_total).toBeCloseTo(28_000, 0);
    expect(flagged[0]?.suspected_threshold).toBe(10_000);
  });

  test('does not flag transactions from different vendors in same window', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-A', date: '2024-06-01', vendor: 'Vendor A', amount: 9_500 },
      { invoice_id: 'INV-B', date: '2024-06-02', vendor: 'Vendor B', amount: 9_500 },
    ];
    const results = detectSplitInvoices(txns, [10_000]);
    expect(results.every((r) => !r.is_split_invoice)).toBe(true);
  });

  test('does not flag when single transaction already exceeds threshold', () => {
    const txns: RawTransaction[] = [
      { invoice_id: 'INV-A', date: '2024-06-01', vendor: 'V', amount: 12_000 },
      { invoice_id: 'INV-B', date: '2024-06-02', vendor: 'V', amount: 9_000 },
    ];
    const results = detectSplitInvoices(txns, [10_000]);
    // INV-A already exceeds threshold — not a split pattern
    expect(results[0]?.is_split_invoice).toBe(false);
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  7. DESCRIPTION AUDIT
// ────────────────────────────────────────────────────────────────────

describe('Description Audit', () => {
  test('vague "Miscellaneous" description scores above 30', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-1',
      date: '2024-01-01',
      vendor: 'V',
      amount: 50_000,
      description: 'Miscellaneous',
    }];
    const results = auditDescriptions(txns);
    expect(results[0]?.description_risk).toBeGreaterThanOrEqual(30);
  });

  test('empty description scores above 50', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-1', date: '2024-01-01', vendor: 'V', amount: 10_000,
    }];
    const results = auditDescriptions(txns);
    expect(results[0]?.description_risk).toBeGreaterThanOrEqual(50);
  });

  test('detailed description scores below 20', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-1',
      date: '2024-01-01',
      vendor: 'V',
      amount: 5_000,
      description: 'Server rack installation and configuration — 3 Dell PowerEdge R750 units, datacenter B, rack 12',
    }];
    const results = auditDescriptions(txns);
    expect(results[0]?.description_risk).toBeLessThan(20);
  });

  test('"Consulting" alone triggers vague flag', () => {
    const txns: RawTransaction[] = [{
      invoice_id: 'INV-1', date: '2024-01-01', vendor: 'V', amount: 5_000,
      description: 'Consulting',
    }];
    const results = auditDescriptions(txns);
    expect(results[0]?.triggered_keywords).toContain('vague: consulting (only)');
  });
});

// ── ─────────────────────────────────────────────────────────────────
//  8. END-TO-END PIPELINE
// ────────────────────────────────────────────────────────────────────

describe('Full Forensic Analysis Pipeline', () => {
  test('handles empty ledger gracefully', () => {
    const result = runForensicAnalysis([]);
    expect(result.transactions.length).toBe(0);
    expect(result.portfolio.score).toBe(0);
    expect(result.portfolio.tier).toBe('LOW');
  });

  test('injected shell company outlier raises portfolio score', () => {
    const normal = makeLognormalTransactions(200);
    const fraudulent: RawTransaction[] = [
      { invoice_id: 'INV-SHELL-1', date: '2024-06-01', vendor: 'Alpha Business Services LLC', amount: 750_000 },
      { invoice_id: 'INV-SHELL-2', date: '2024-07-01', vendor: 'Alpha Business Services LLC', amount: 680_000 },
      { invoice_id: 'INV-SHELL-3', date: '2024-08-01', vendor: 'Alpha Business Services LLC', amount: 820_000 },
    ];

    const result = runForensicAnalysis([...normal, ...fraudulent]);
    expect(result.portfolio.score).toBeGreaterThan(30);

    // Shell company transactions should have RSF flags
    const shellTxns = result.transactions.filter(
      (t) => t.vendor === 'Alpha Business Services LLC'
    );
    expect(shellTxns.every((t) => t.rsf_flag)).toBe(true);
  });

  test('duplicate invoices are detected in full pipeline', () => {
    const normal = makeLognormalTransactions(50);
    const dup: RawTransaction[] = [
      { invoice_id: 'INV-DUP-A', date: '2024-03-15', vendor: 'Meridian IT Solutions', amount: 12_450 },
      { invoice_id: 'INV-DUP-B', date: '2024-03-15', vendor: 'Meridian IT Solutions', amount: 12_450 },
    ];
    const result = runForensicAnalysis([...normal, ...dup]);

    const dupTxns = result.transactions.filter(
      (t) => t.vendor === 'Meridian IT Solutions' && t.date === '2024-03-15'
    );
    expect(dupTxns.every((t) => t.is_exact_duplicate)).toBe(true);
    expect(dupTxns.every((t) => t.triggered_detectors.includes('EXACT_DUPLICATE'))).toBe(true);
  });

  test('all analyzed transactions have complete AnalyzedTransaction shape', () => {
    const txns = makeLognormalTransactions(20);
    const result = runForensicAnalysis(txns);

    for (const t of result.transactions) {
      expect(typeof t.composite_risk).toBe('number');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(t.risk_tier);
      expect(typeof t.is_outlier).toBe('boolean');
      expect(typeof t.rsf_flag).toBe('boolean');
      expect(typeof t.is_exact_duplicate).toBe('boolean');
      expect(Array.isArray(t.triggered_detectors)).toBe(true);
      expect(t.composite_risk).toBeGreaterThanOrEqual(0);
      expect(t.composite_risk).toBeLessThanOrEqual(100);
    }
  });

  test('portfolio estimated_exposure equals sum of HIGH+CRITICAL transaction amounts', () => {
    const txns = makeLognormalTransactions(100);
    // Inject obvious fraud to ensure some HIGH/CRITICAL transactions
    txns.push(
      { invoice_id: 'F1', date: '2024-01-01', vendor: 'Shell Co', amount: 900_000 },
      { invoice_id: 'F2', date: '2024-01-01', vendor: 'Shell Co', amount: 850_000 }
    );

    const result = runForensicAnalysis(txns);
    const expectedExposure = result.transactions
      .filter((t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL')
      .reduce((sum, t) => sum + t.amount, 0);

    expect(result.portfolio.estimated_exposure).toBeCloseTo(expectedExposure, 0);
  });
});
