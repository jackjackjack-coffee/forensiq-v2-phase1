'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { runForensicAnalysis } from '@/lib/fraud-logic/index';
import { parseCsv, autoDetectMapping } from '@/lib/parsers/csv';
import type { AnalysisResult, AnalyzedTransaction, RiskTier } from '@/lib/types/transaction';

// ── Constants ─────────────────────────────────────────────────────

const TIER_BADGE: Record<RiskTier, string> = {
  LOW: 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-700',
  MEDIUM: 'bg-yellow-900/60 text-yellow-300 ring-1 ring-yellow-700',
  HIGH: 'bg-orange-900/60 text-orange-300 ring-1 ring-orange-700',
  CRITICAL: 'bg-red-900/60 text-red-300 ring-1 ring-red-700',
};

const TIER_BAR: Record<RiskTier, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

const TIER_DOT: Record<RiskTier, string> = {
  LOW: 'bg-emerald-400',
  MEDIUM: 'bg-yellow-400',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-400',
};

type Section = 'upload' | 'overview' | 'transactions' | 'benford' | 'detectors';

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'upload', label: 'Upload', icon: '↑' },
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'transactions', label: 'Transactions', icon: '≡' },
  { id: 'benford', label: 'Benford Analysis', icon: '∿' },
  { id: 'detectors', label: 'Detectors', icon: '⬡' },
];

// ── Formatters ────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

// ── Sub-components ────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function TierPill({ tier }: { tier: RiskTier }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIER_BADGE[tier]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[tier]}`} />
      {tier}
    </span>
  );
}

// ── Section: Upload ───────────────────────────────────────────────

function UploadSection({
  onAnalysis,
  loading,
  error,
  hasResult,
}: {
  onAnalysis: (r: AnalysisResult) => void;
  loading: boolean;
  error: string | null;
  hasResult: boolean;
}) {
  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const mapping = autoDetectMapping(text);
        const parsed = parseCsv(text, mapping);
        if (parsed.transactions.length === 0) return;
        onAnalysis(runForensicAnalysis(parsed.transactions));
      };
      reader.readAsText(file);
    },
    [onAnalysis]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.txt'] },
    multiple: false,
  });

  return (
    <div className="max-w-2xl mx-auto py-16 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload Transaction Data</h2>
        <p className="text-gray-400 mt-1 text-sm">
          Drop any CSV with an amount column. Date and vendor are auto-detected.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-950/20'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/40'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-4">📂</div>
        {loading ? (
          <p className="text-gray-400 font-medium">Analyzing…</p>
        ) : (
          <>
            <p className="text-lg font-semibold">Drop a CSV file here</p>
            <p className="text-gray-500 text-sm mt-1">or click to browse</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {hasResult && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm">
          Analysis complete — navigate using the sidebar.
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-400 mb-2">Supported column names (auto-detected)</p>
        <p><span className="text-gray-300">Amount:</span> amount, amt, total, value, invoice_amount</p>
        <p><span className="text-gray-300">Date:</span> date, invoice_date, posting_date, trans_date</p>
        <p><span className="text-gray-300">Vendor:</span> vendor, supplier, payee, company</p>
        <p><span className="text-gray-300">Invoice ID:</span> invoice_id, invoice_number, reference</p>
        <p><span className="text-gray-300">Description:</span> description, desc, memo, notes</p>
      </div>
    </div>
  );
}

// ── Section: Overview ─────────────────────────────────────────────

function OverviewSection({ result }: { result: AnalysisResult }) {
  const p = result.portfolio;
  const criticalTxns = result.transactions.filter((t) => t.risk_tier === 'CRITICAL');
  const highTxns = result.transactions.filter((t) => t.risk_tier === 'HIGH');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Portfolio Overview</h2>
        <p className="text-gray-400 text-sm mt-1">{p.total_transactions.toLocaleString()} transactions analyzed</p>
      </div>

      {/* Risk tier banner */}
      <div className={`rounded-2xl p-6 border ${
        p.tier === 'CRITICAL' ? 'bg-red-950/40 border-red-800' :
        p.tier === 'HIGH' ? 'bg-orange-950/40 border-orange-800' :
        p.tier === 'MEDIUM' ? 'bg-yellow-950/40 border-yellow-800' :
        'bg-emerald-950/40 border-emerald-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-widest">Portfolio Risk</p>
            <p className="text-5xl font-black mt-1">{p.score.toFixed(0)}<span className="text-2xl text-gray-500">/100</span></p>
          </div>
          <TierPill tier={p.tier} />
        </div>
        <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${TIER_BAR[p.tier]}`}
            style={{ width: `${p.score}%` }}
          />
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Flagged Transactions" value={p.flagged_transactions.toString()} sub={`of ${p.total_transactions}`} />
        <StatCard label="Estimated Exposure" value={fmt(p.estimated_exposure)} />
        <StatCard label="Outlier Rate" value={pct(p.outlier_rate)} />
        <StatCard label="Duplicate Rate" value={pct(p.duplicate_rate)} />
        <StatCard label="Round Number Rate" value={pct(p.round_number_rate)} />
        <StatCard label="RSF Flag Rate" value={pct(p.rsf_flag_rate)} />
        <StatCard label="Benford MAD" value={p.benford_mad.toFixed(4)} />
        <StatCard label="Benford Conformity" value={result.benford_1st.conformity} />
      </div>

      {/* Top flagged */}
      {(criticalTxns.length > 0 || highTxns.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Top Flagged Transactions</h3>
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  {['Vendor', 'Amount', 'Date', 'Risk', 'Score'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[...criticalTxns, ...highTxns].slice(0, 10).map((t) => (
                  <tr key={t.invoice_id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-medium">{t.vendor}</td>
                    <td className="px-4 py-3 font-mono">{fmt(t.amount)}</td>
                    <td className="px-4 py-3 text-gray-400">{t.date}</td>
                    <td className="px-4 py-3"><TierPill tier={t.risk_tier} /></td>
                    <td className="px-4 py-3 font-mono text-gray-300">{t.composite_risk.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section: Transactions ─────────────────────────────────────────

function TransactionsSection({ transactions }: { transactions: AnalyzedTransaction[] }) {
  const [filter, setFilter] = useState<RiskTier | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = transactions.filter((t) => {
    if (filter !== 'ALL' && t.risk_tier !== filter) return false;
    if (search && !t.vendor.toLowerCase().includes(search.toLowerCase()) && !t.invoice_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    ALL: transactions.length,
    CRITICAL: transactions.filter((t) => t.risk_tier === 'CRITICAL').length,
    HIGH: transactions.filter((t) => t.risk_tier === 'HIGH').length,
    MEDIUM: transactions.filter((t) => t.risk_tier === 'MEDIUM').length,
    LOW: transactions.filter((t) => t.risk_tier === 'LOW').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transactions</h2>
        <p className="text-gray-400 text-sm mt-1">{filtered.length.toLocaleString()} shown</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filter === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t !== 'ALL' && <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[t as RiskTier]}`} />}
            {t}
            <span className="text-gray-500 font-normal">{counts[t]}</span>
          </button>
        ))}
        <input
          type="text"
          placeholder="Search vendor or invoice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 w-56"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                {['Invoice', 'Date', 'Vendor', 'Amount', 'Risk', 'Score', 'Detectors'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.slice(0, 500).map((txn) => (
                <tr key={txn.invoice_id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{txn.invoice_id}</td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{txn.date}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[180px] truncate">{txn.vendor}</td>
                  <td className="px-4 py-2.5 font-mono">{fmt(txn.amount)}</td>
                  <td className="px-4 py-2.5"><TierPill tier={txn.risk_tier} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-14 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${TIER_BAR[txn.risk_tier]}`} style={{ width: `${txn.composite_risk}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums">{txn.composite_risk.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {txn.triggered_detectors.slice(0, 3).map((d) => (
                        <span key={d} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                          {d.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {txn.triggered_detectors.length > 3 && (
                        <span className="text-xs text-gray-600">+{txn.triggered_detectors.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <p className="text-center text-gray-600 text-xs py-3 border-t border-gray-800">
            Showing 500 of {filtered.length.toLocaleString()} transactions
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section: Benford ──────────────────────────────────────────────

function BenfordSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Benford&apos;s Law Analysis</h2>
        <p className="text-gray-400 text-sm mt-1">
          Natural transaction data follows Benford&apos;s Law. Significant deviation suggests manipulation.
        </p>
      </div>

      {[result.benford_1st, result.benford_2nd].map((b) => {
        const maxObs = Math.max(...Object.values(b.observed), 1);
        return (
          <div key={b.digit_position} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">
                {b.digit_position === 1 ? '1st' : '2nd'} Digit Distribution
              </h3>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                b.conformity === 'ACCEPTABLE' ? 'bg-emerald-900/60 text-emerald-300' :
                b.conformity === 'MARGINAL' ? 'bg-yellow-900/60 text-yellow-300' :
                'bg-red-900/60 text-red-300'
              }`}>
                {b.conformity}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Chi-Square:</span> <span className="font-mono">{b.chi_square.toFixed(2)}</span></div>
              <div><span className="text-gray-500">MAD:</span> <span className="font-mono">{b.mad.toFixed(4)}</span></div>
              <div><span className="text-gray-500">Records:</span> <span className="font-mono">{b.total_records}</span></div>
            </div>

            {/* Bar chart */}
            <div className="flex gap-2 items-end h-40 pt-4">
              {Object.entries(b.observed).map(([digit, obs]) => {
                const exp = b.expected[Number(digit)] ?? 0;
                const obsH = (obs / maxObs) * 140;
                const expH = (exp / maxObs) * 140;
                const diff = Math.abs(obs - exp);
                const isDeviant = diff > 3;
                return (
                  <div key={digit} className="flex-1 flex flex-col items-center gap-1">
                    <div className="relative w-full" style={{ height: 140 }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t-sm transition-all ${isDeviant ? 'bg-red-600/80' : 'bg-blue-600/70'}`}
                        style={{ height: obsH }}
                      />
                      <div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-yellow-400"
                        style={{ height: expH }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs">{digit}</span>
                    <span className="text-gray-600 text-xs font-mono">{obs.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-blue-600/70 inline-block" /> Observed</span>
              <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-yellow-400 inline-block" /> Expected</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-600/80 inline-block" /> Deviant (&gt;3%)</span>
            </div>
          </div>
        );
      })}

      {/* Round numbers */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Round Number Analysis</h3>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            result.round_number.flagged ? 'bg-red-900/60 text-red-300' : 'bg-emerald-900/60 text-emerald-300'
          }`}>
            {result.round_number.flagged ? 'FLAGGED' : 'NORMAL'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Round number count:</span> <span className="font-mono font-semibold ml-2">{result.round_number.round_count}</span></div>
          <div><span className="text-gray-500">Rate:</span> <span className="font-mono font-semibold ml-2">{pct(result.round_number.round_rate)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Detectors ────────────────────────────────────────────

function DetectorsSection({ transactions }: { transactions: AnalyzedTransaction[] }) {
  const detectorNames = [
    'BENFORD_1ST', 'BENFORD_2ND', 'ROUND_NUMBER', 'ISOLATION_FOREST',
    'RSF', 'EXACT_DUPLICATE', 'FUZZY_DUPLICATE', 'SPLIT_INVOICE', 'DESCRIPTION_AUDIT',
  ] as const;

  const counts = detectorNames.map((d) => ({
    name: d,
    count: transactions.filter((t) => t.triggered_detectors.includes(d)).length,
    rate: transactions.length > 0
      ? transactions.filter((t) => t.triggered_detectors.includes(d)).length / transactions.length
      : 0,
  }));

  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Detector Results</h2>
        <p className="text-gray-400 text-sm mt-1">How many transactions each detector flagged.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        {counts.map(({ name, count, rate }) => (
          <div key={name} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">{name.replace(/_/g, ' ')}</span>
              <span className="font-mono text-gray-400">{count} <span className="text-gray-600">({pct(rate)})</span></span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Vendor risk table */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Top Risky Vendors</h3>
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                {['Vendor', 'Transactions', 'Avg Risk Score', 'Max Tier'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {Object.entries(
                transactions.reduce<Record<string, AnalyzedTransaction[]>>((acc, t) => {
                  (acc[t.vendor] ??= []).push(t);
                  return acc;
                }, {})
              )
                .map(([vendor, txns]) => ({
                  vendor,
                  count: txns.length,
                  avgScore: txns.reduce((s, t) => s + t.composite_risk, 0) / txns.length,
                  maxTier: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RiskTier[]).find(
                    (tier) => txns.some((t) => t.risk_tier === tier)
                  ) ?? 'LOW',
                }))
                .sort((a, b) => b.avgScore - a.avgScore)
                .slice(0, 20)
                .map(({ vendor, count, avgScore, maxTier }) => (
                  <tr key={vendor} className="hover:bg-gray-900/50">
                    <td className="px-4 py-2.5 font-medium">{vendor}</td>
                    <td className="px-4 py-2.5 text-gray-400">{count}</td>
                    <td className="px-4 py-2.5 font-mono">{avgScore.toFixed(1)}</td>
                    <td className="px-4 py-2.5"><TierPill tier={maxTier} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [section, setSection] = useState<Section>('upload');

  const handleAnalysis = useCallback((r: AnalysisResult) => {
    setResult(r);
    setError(null);
    setLoading(false);
    setSection('overview');
  }, []);

  const handleDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const mapping = autoDetectMapping(text);
          const parsed = parseCsv(text, mapping);
          if (parsed.transactions.length === 0) {
            setError('No valid transactions found. Ensure the CSV has a numeric amount column.');
            setLoading(false);
            return;
          }
          handleAnalysis(runForensicAnalysis(parsed.transactions));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Analysis failed.');
          setLoading(false);
        }
      };
      reader.readAsText(file);
    },
    [handleAnalysis]
  );

  const availableSections = result
    ? NAV
    : NAV.filter((n) => n.id === 'upload');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-6 border-b border-gray-800">
          <p className="text-lg font-bold tracking-tight">ForensiQ</p>
          <p className="text-xs text-gray-500 mt-0.5">Fraud Detection</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV.map((item) => {
            const disabled = !result && item.id !== 'upload';
            return (
              <button
                key={item.id}
                onClick={() => !disabled && setSection(item.id)}
                disabled={disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  section === item.id
                    ? 'bg-blue-600/20 text-blue-400'
                    : disabled
                    ? 'text-gray-700 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {result && (
          <div className="px-4 py-4 border-t border-gray-800">
            <div className={`text-xs font-semibold px-2 py-1 rounded text-center ${TIER_BADGE[result.portfolio.tier]}`}>
              {result.portfolio.tier} RISK · {result.portfolio.score.toFixed(0)}/100
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-8 py-10">
          {section === 'upload' && (
            <UploadSection
              onAnalysis={handleAnalysis}
              loading={loading}
              error={error}
              hasResult={!!result}
            />
          )}
          {section === 'overview' && result && <OverviewSection result={result} />}
          {section === 'transactions' && result && <TransactionsSection transactions={result.transactions} />}
          {section === 'benford' && result && <BenfordSection result={result} />}
          {section === 'detectors' && result && <DetectorsSection transactions={result.transactions} />}
        </div>
      </main>
    </div>
  );
}
