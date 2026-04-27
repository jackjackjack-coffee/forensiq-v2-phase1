'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { runForensicAnalysis } from '@/lib/fraud-logic/index';
import { parseCsv, autoDetectMapping } from '@/lib/parsers/csv';
import type { AnalysisResult, AnalyzedTransaction, RiskTier } from '@/lib/types/transaction';

const TIER_STYLES: Record<RiskTier, string> = {
  LOW: 'bg-green-900 text-green-300',
  MEDIUM: 'bg-yellow-900 text-yellow-300',
  HIGH: 'bg-orange-900 text-orange-300',
  CRITICAL: 'bg-red-900 text-red-300',
};

const TIER_BAR: Record<RiskTier, string> = {
  LOW: 'bg-green-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<RiskTier | 'ALL'>('ALL');

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const mapping = autoDetectMapping(text);
        const parsed = parseCsv(text, mapping);

        if (parsed.transactions.length === 0) {
          setError('No valid transactions found. Check that the CSV has amount, date, and vendor columns.');
          setLoading(false);
          return;
        }

        const analysis = runForensicAnalysis(parsed.transactions);
        setResult(analysis);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    multiple: false,
  });

  const filtered: AnalyzedTransaction[] = result
    ? filter === 'ALL'
      ? result.transactions
      : result.transactions.filter((t) => t.risk_tier === filter)
    : [];

  const p = result?.portfolio;

  return (
    <main className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ForensiQ</h1>
        <p className="text-gray-400 mt-1">Forensic Accounting Fraud Detection</p>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-950/30' : 'border-gray-700 hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        {loading ? (
          <p className="text-gray-400">Analyzing...</p>
        ) : (
          <>
            <p className="text-lg font-medium">Drop a CSV file here</p>
            <p className="text-gray-500 text-sm mt-1">or click to browse — columns are auto-detected</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Portfolio Summary */}
      {p && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Portfolio Risk Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Risk Score', value: p.score.toFixed(0) + ' / 100' },
              { label: 'Tier', value: p.tier },
              { label: 'Flagged', value: `${p.flagged_transactions} / ${p.total_transactions}` },
              { label: 'Exposure', value: fmt(p.estimated_exposure) },
              { label: 'Outlier Rate', value: pct(p.outlier_rate) },
              { label: 'Duplicate Rate', value: pct(p.duplicate_rate) },
              { label: 'Round Number Rate', value: pct(p.round_number_rate) },
              { label: "Benford MAD", value: p.benford_mad.toFixed(4) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 rounded-lg p-4">
                <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Benford conformity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([result.benford_1st, result.benford_2nd] as const).map((b) => (
              <div key={b.digit_position} className="bg-gray-900 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">
                  Benford {b.digit_position === 1 ? '1st' : '2nd'} Digit —{' '}
                  <span className={b.conformity === 'ACCEPTABLE' ? 'text-green-400' : b.conformity === 'MARGINAL' ? 'text-yellow-400' : 'text-red-400'}>
                    {b.conformity}
                  </span>
                </p>
                <div className="flex gap-1 items-end h-12">
                  {Object.entries(b.observed).map(([digit, obs]) => {
                    const exp = b.expected[Number(digit)] ?? 0;
                    const height = Math.round((obs / Math.max(...Object.values(b.observed))) * 48);
                    const expHeight = Math.round((exp / Math.max(...Object.values(b.observed))) * 48);
                    return (
                      <div key={digit} className="flex flex-col items-center flex-1 gap-0.5">
                        <div className="w-full relative" style={{ height: 48 }}>
                          <div
                            className="absolute bottom-0 w-full bg-blue-600 rounded-sm opacity-80"
                            style={{ height }}
                          />
                          <div
                            className="absolute bottom-0 w-0.5 bg-yellow-400 left-1/2 -translate-x-1/2"
                            style={{ height: expHeight }}
                          />
                        </div>
                        <span className="text-gray-500 text-xs">{digit}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">Blue = observed &nbsp;|&nbsp; Yellow = Benford expected</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Table */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <div className="flex gap-2">
              {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  {['Invoice', 'Date', 'Vendor', 'Amount', 'Risk', 'Score', 'Detectors'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.slice(0, 500).map((txn) => (
                  <tr key={txn.invoice_id} className="hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-2 font-mono text-gray-400 text-xs">{txn.invoice_id}</td>
                    <td className="px-4 py-2 text-gray-300">{txn.date}</td>
                    <td className="px-4 py-2 font-medium truncate max-w-[160px]">{txn.vendor}</td>
                    <td className="px-4 py-2 font-mono">{fmt(txn.amount)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_STYLES[txn.risk_tier]}`}>
                        {txn.risk_tier}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${TIER_BAR[txn.risk_tier]}`}
                            style={{ width: `${txn.composite_risk}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{txn.composite_risk.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {txn.triggered_detectors.slice(0, 3).map((d) => (
                          <span key={d} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {d.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {txn.triggered_detectors.length > 3 && (
                          <span className="text-xs text-gray-500">+{txn.triggered_detectors.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <p className="text-center text-gray-500 text-xs py-3">
                Showing first 500 of {filtered.length} transactions
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
