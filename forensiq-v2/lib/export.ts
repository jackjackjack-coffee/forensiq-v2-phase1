// lib/export.ts
// ─────────────────────────────────────────────────────────────────
// Risk report export. Generates a multi-tab Excel workbook with
// flagged transactions, full transaction list, portfolio summary,
// detector explanations, and a Benford summary.
// ─────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import type { AnalysisResult, AnalyzedTransaction, DetectorName } from './types/transaction';
import { DETECTOR_INFO } from './detector-info';
import { categorizeMad } from './benford-categories';

function txnRow(t: AnalyzedTransaction) {
  return {
    Invoice: t.invoice_id,
    Date: t.date,
    Vendor: t.vendor,
    Amount: t.amount,
    Description: t.description ?? '',
    'Risk Tier': t.risk_tier,
    'Composite Score': Number(t.composite_risk.toFixed(2)),
    'Isolation Score': Number(t.isolation_score.toFixed(2)),
    'RSF': Number(t.rsf.toFixed(2)),
    'RSF Flagged': t.rsf_flag ? 'YES' : '',
    'Exact Duplicate': t.is_exact_duplicate ? 'YES' : '',
    'Fuzzy Duplicate': t.fuzzy_dup_group ? 'YES' : '',
    'Split Invoice': t.is_split_invoice ? 'YES' : '',
    'Round Number': t.is_round_number ? 'YES' : '',
    'Description Risk': Number(t.description_risk.toFixed(2)),
    'Detectors Triggered': t.triggered_detectors.join(', '),
  };
}

export function exportRiskReport(result: AnalysisResult, fileName = 'forensiq-risk-report.xlsx') {
  const wb = XLSX.utils.book_new();

  // ── Tab 1: Executive Summary ─────────────────────────────────
  const p = result.portfolio;
  const summaryRows = [
    { Metric: 'Total Transactions',     Value: p.total_transactions },
    { Metric: 'Flagged Transactions',   Value: p.flagged_transactions },
    { Metric: 'Estimated Exposure',     Value: p.estimated_exposure },
    { Metric: 'Portfolio Risk Score',   Value: Number(p.score.toFixed(2)) },
    { Metric: 'Risk Tier',              Value: p.tier },
    { Metric: 'Outlier Rate',           Value: `${(p.outlier_rate * 100).toFixed(2)}%` },
    { Metric: 'RSF Flag Rate',          Value: `${(p.rsf_flag_rate * 100).toFixed(2)}%` },
    { Metric: 'Duplicate Rate',         Value: `${(p.duplicate_rate * 100).toFixed(2)}%` },
    { Metric: 'Round Number Rate',      Value: `${(p.round_number_rate * 100).toFixed(2)}%` },
    { Metric: 'Benford 1st-digit MAD',  Value: Number(p.benford_mad.toFixed(4)) },
    { Metric: 'Benford 1st conformity', Value: result.benford_1st.conformity },
    { Metric: 'Benford 2nd-digit MAD',  Value: Number(result.benford_2nd.mad.toFixed(4)) },
    { Metric: 'Benford 2nd conformity', Value: result.benford_2nd.conformity },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Executive Summary');

  // ── Tab 2: Flagged Transactions ──────────────────────────────
  const flagged = result.transactions
    .filter((t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL')
    .sort((a, b) => b.composite_risk - a.composite_risk)
    .map(txnRow);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flagged), 'Flagged Transactions');

  // ── Tab 3: All Transactions ──────────────────────────────────
  const all = result.transactions.map(txnRow);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(all), 'All Transactions');

  // ── Tab 4: Detector Explanations ─────────────────────────────
  const detectorNames = Object.keys(DETECTOR_INFO) as DetectorName[];
  const explanations = detectorNames.map((d) => {
    const info = DETECTOR_INFO[d];
    const triggeredCount = result.transactions.filter((t) => t.triggered_detectors.includes(d)).length;
    return {
      Detector: info.name,
      'Short Description': info.short,
      'Full Explanation': info.long,
      'Methodology Basis': info.basis,
      'Transactions Flagged': triggeredCount,
      'Flag Rate': result.transactions.length > 0
        ? `${((triggeredCount / result.transactions.length) * 100).toFixed(2)}%`
        : '0%',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(explanations), 'Detector Explanations');

  // ── Tab 5: Benford Detail ────────────────────────────────────
  const cat1 = categorizeMad(result.benford_1st.mad, 1);
  const cat2 = categorizeMad(result.benford_2nd.mad, 2);
  const benfordRows = [
    { Position: '1st digit', MAD: Number(result.benford_1st.mad.toFixed(4)), Category: cat1.label, Range: cat1.range, Interpretation: cat1.description },
    { Position: '2nd digit', MAD: Number(result.benford_2nd.mad.toFixed(4)), Category: cat2.label, Range: cat2.range, Interpretation: cat2.description },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(benfordRows), 'Benford Analysis');

  // ── Tab 6: Vendor Risk Summary ───────────────────────────────
  const byVendor = new Map<string, AnalyzedTransaction[]>();
  for (const t of result.transactions) {
    const list = byVendor.get(t.vendor) ?? [];
    list.push(t);
    byVendor.set(t.vendor, list);
  }
  const vendorRows = Array.from(byVendor.entries())
    .map(([vendor, txns]) => ({
      Vendor: vendor,
      'Transaction Count': txns.length,
      'Total Spend': txns.reduce((s, t) => s + t.amount, 0),
      'Avg Risk Score': Number((txns.reduce((s, t) => s + t.composite_risk, 0) / txns.length).toFixed(2)),
      'Max Risk Score': Number(Math.max(...txns.map((t) => t.composite_risk)).toFixed(2)),
      'Flagged Transactions': txns.filter((t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL').length,
    }))
    .sort((a, b) => b['Avg Risk Score'] - a['Avg Risk Score']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendorRows), 'Vendor Risk');

  XLSX.writeFile(wb, fileName);
}
