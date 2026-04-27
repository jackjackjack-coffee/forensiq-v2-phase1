'use client';

import { useState, useCallback, useMemo, useEffect, Fragment } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine, Cell,
} from 'recharts';
import { runForensicAnalysisAsync, type ProgressUpdate } from '@/lib/fraud-logic/run-async';
import { parseCsv, autoDetectMapping } from '@/lib/parsers/csv';
import { exportRiskReport } from '@/lib/export';
import { DETECTOR_INFO } from '@/lib/detector-info';
import {
  categorizeMad, BENFORD_1ST_CATEGORIES, BENFORD_2ND_CATEGORIES,
} from '@/lib/benford-categories';
import type {
  AnalysisResult, AnalyzedTransaction, RiskTier, DetectorName,
} from '@/lib/types/transaction';

// ── Tier styling (color-blind safe with icons) ───────────────────

const TIER_BADGE: Record<RiskTier, string> = {
  LOW: 'bg-gray-800 text-gray-300 ring-1 ring-gray-700',
  MEDIUM: 'bg-yellow-900/60 text-yellow-200 ring-1 ring-yellow-700',
  HIGH: 'bg-orange-900/60 text-orange-200 ring-1 ring-orange-700',
  CRITICAL: 'bg-red-900/80 text-red-100 ring-1 ring-red-600',
};
const TIER_BAR: Record<RiskTier, string> = {
  LOW: 'bg-gray-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};
const TIER_FILL: Record<RiskTier, string> = {
  LOW: '#6b7280',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};
const TIER_ICON: Record<RiskTier, string> = {
  LOW: '○',
  MEDIUM: '◐',
  HIGH: '◑',
  CRITICAL: '●',
};

type Section = 'upload' | 'overview' | 'transactions' | 'vendors' | 'benford' | 'detectors';

const NAV: { id: Section; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'benford', label: 'Benford Analysis' },
  { id: 'detectors', label: 'Detectors' },
];

// ── Formatters ────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pct = (n: number) => (n * 100).toFixed(1) + '%';

// ── Generic UI atoms ─────────────────────────────────────────────

function TierPill({ tier }: { tier: RiskTier }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${TIER_BADGE[tier]}`}>
      <span aria-hidden>{TIER_ICON[tier]}</span>
      {tier}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function InfoTooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && (
        <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 text-xs bg-gray-950 border border-gray-700 rounded-lg shadow-xl text-gray-300 normal-case font-normal tracking-normal">
          {content}
        </span>
      )}
    </span>
  );
}

// ── Loading Overlay ──────────────────────────────────────────────

function LoadingOverlay({ progress }: { progress: ProgressUpdate | null }) {
  if (!progress) return null;
  const pctDone = (progress.step / progress.total) * 100;
  return (
    <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-md px-8 space-y-6">
        <div className="flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-2 border-gray-700 border-t-blue-500 animate-spin" />
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-300 font-medium">{progress.label}</span>
            <span className="text-gray-500 tabular-nums">{progress.step} / {progress.total}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${pctDone}%` }}
            />
          </div>
        </div>
        <p className="text-center text-xs text-gray-500">Running forensic analysis…</p>
      </div>
    </div>
  );
}

// ── Transaction Detail Drawer ─────────────────────────────────────

function DetailDrawer({ txn, onClose }: { txn: AnalyzedTransaction | null; onClose: () => void }) {
  if (!txn) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-xl bg-gray-950 border-l border-gray-800 z-50 overflow-y-auto">
        <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Transaction Detail</p>
            <p className="font-mono text-sm text-gray-300">{txn.invoice_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 text-xl leading-none px-2"
            aria-label="Close"
          >×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <TierPill tier={txn.risk_tier} />
              <span className="text-2xl font-bold tabular-nums">{txn.composite_risk.toFixed(0)}<span className="text-gray-600 text-base">/100</span></span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Vendor</p><p className="font-medium">{txn.vendor}</p></div>
              <div><p className="text-gray-500 text-xs">Amount</p><p className="font-mono">{fmt(txn.amount)}</p></div>
              <div><p className="text-gray-500 text-xs">Date</p><p>{txn.date}</p></div>
              <div><p className="text-gray-500 text-xs">Category</p><p>{txn.category ?? '—'}</p></div>
            </div>
            {txn.description && (
              <div><p className="text-gray-500 text-xs">Description</p><p className="text-sm text-gray-300">{txn.description}</p></div>
            )}
          </div>

          {/* Detectors */}
          <div>
            <h3 className="font-semibold mb-3">Detector Findings</h3>
            <div className="space-y-2">
              {(Object.keys(DETECTOR_INFO) as DetectorName[]).map((d) => {
                const triggered = txn.triggered_detectors.includes(d);
                const info = DETECTOR_INFO[d];
                return (
                  <div
                    key={d}
                    className={`rounded-lg p-3 border ${
                      triggered ? 'bg-red-950/30 border-red-900' : 'bg-gray-900 border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${triggered ? 'text-red-200' : 'text-gray-400'}`}>
                          {info.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{info.short}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        triggered ? 'bg-red-900 text-red-200' : 'bg-gray-800 text-gray-600'
                      }`}>
                        {triggered ? 'FLAGGED' : 'OK'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw scores */}
          <div>
            <h3 className="font-semibold mb-3">Detector Scores</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Isolation Score',  value: txn.isolation_score.toFixed(2),     bar: txn.isolation_score },
                { label: 'RSF',              value: txn.rsf.toFixed(2) + 'x',            bar: Math.min(txn.rsf * 20, 100) },
                { label: 'Description Risk', value: txn.description_risk.toFixed(2),   bar: txn.description_risk },
                { label: 'Benford 1st digit', value: txn.benford_first_digit.toString(), bar: 0 },
                { label: 'Duplicate count',  value: txn.dup_count.toString(),           bar: txn.dup_count > 1 ? 100 : 0 },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-[1fr_auto_120px] gap-3 items-center">
                  <span className="text-gray-400">{row.label}</span>
                  <span className="font-mono text-gray-200 tabular-nums">{row.value}</span>
                  {row.bar > 0 ? (
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${Math.min(row.bar, 100)}%` }} />
                    </div>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// ── Section: Upload ──────────────────────────────────────────────

function UploadSection({
  onDrop, error, hasResult,
}: {
  onDrop: (files: File[]) => void;
  error: string | null;
  hasResult: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false,
  });

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Upload Transaction Data</h2>
        <p className="text-gray-400 mt-1 text-sm">
          Drop any CSV. The amount column is auto-detected; date and vendor are optional.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900/40'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-5xl mb-3 select-none">⇪</div>
        <p className="text-lg font-semibold">Drop a CSV file here</p>
        <p className="text-gray-500 text-sm mt-1">or click to browse</p>
      </div>

      {error && (
        <div className="bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}
      {hasResult && (
        <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl px-4 py-3 text-sm">
          Analysis complete — navigate using the sidebar.
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-medium text-gray-300 mb-2">Need a sample to try?</p>
        <a href="/sample.csv" download className="text-blue-400 hover:text-blue-300 underline">Download sample-transactions.csv</a>
        <p className="mt-3 text-gray-500">Auto-detected columns: amount/total/value, date/invoice_date, vendor/supplier, invoice_id, description.</p>
      </div>
    </div>
  );
}

// ── Section: Overview ────────────────────────────────────────────

function OverviewSection({ result, onExport }: { result: AnalysisResult; onExport: () => void }) {
  const p = result.portfolio;

  // Top firing detectors
  const detectorCounts = useMemo(() => {
    const counts: Partial<Record<DetectorName, number>> = {};
    for (const t of result.transactions) {
      for (const d of t.triggered_detectors) {
        counts[d] = (counts[d] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({
        name: name as DetectorName,
        count: count!,
        rate: count! / Math.max(result.transactions.length, 1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [result.transactions]);

  // Histogram of risk scores
  const histogramData = useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${i * 10 + 10}`,
      lo: i * 10,
      count: 0,
    }));
    for (const t of result.transactions) {
      const idx = Math.min(Math.floor(t.composite_risk / 10), 9);
      bins[idx]!.count++;
    }
    return bins;
  }, [result.transactions]);

  // Time series (transactions per day, by tier)
  const timeSeriesData = useMemo(() => {
    const byDay = new Map<string, { date: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }>();
    for (const t of result.transactions) {
      const day = byDay.get(t.date) ?? { date: t.date, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
      day[t.risk_tier]++;
      byDay.set(t.date, day);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [result.transactions]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Overview</h2>
          <p className="text-gray-400 text-sm mt-1">{p.total_transactions.toLocaleString()} transactions analyzed</p>
        </div>
        <button
          onClick={onExport}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <span>↓</span> Export Risk Report (Excel)
        </button>
      </div>

      {/* Why is this risky? */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Why is this portfolio risky?</h3>
        {detectorCounts.length === 0 ? (
          <p className="text-gray-500 text-sm">No detectors triggered. Portfolio appears clean.</p>
        ) : (
          <div className="space-y-3">
            {detectorCounts.map((d, i) => {
              const info = DETECTOR_INFO[d.name];
              return (
                <div key={d.name} className="flex items-start gap-4">
                  <span className="text-3xl font-bold text-gray-700 tabular-nums w-8">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{info.name}</span>
                      <span className="text-sm text-gray-400 tabular-nums">{d.count} txns ({pct(d.rate)})</span>
                    </div>
                    <p className="text-sm text-gray-500">{info.short}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Score banner */}
      <div className={`rounded-2xl p-6 border ${
        p.tier === 'CRITICAL' ? 'bg-red-950/40 border-red-800' :
        p.tier === 'HIGH' ? 'bg-orange-950/40 border-orange-800' :
        p.tier === 'MEDIUM' ? 'bg-yellow-950/40 border-yellow-800' :
        'bg-gray-900 border-gray-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 uppercase tracking-widest">Portfolio Risk</p>
            <p className="text-5xl font-black mt-1">{p.score.toFixed(0)}<span className="text-2xl text-gray-500">/100</span></p>
          </div>
          <TierPill tier={p.tier} />
        </div>
        <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${TIER_BAR[p.tier]}`} style={{ width: `${p.score}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Flagged" value={p.flagged_transactions.toString()} sub={`of ${p.total_transactions}`} />
        <StatCard label="Estimated Exposure" value={fmt(p.estimated_exposure)} />
        <StatCard label="Outlier Rate" value={pct(p.outlier_rate)} />
        <StatCard label="Duplicate Rate" value={pct(p.duplicate_rate)} />
      </div>

      {/* Histogram */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="font-semibold mb-2">Risk Score Distribution</h3>
        <p className="text-xs text-gray-500 mb-4">How transaction risk scores are spread across the portfolio.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={histogramData}>
            <CartesianGrid stroke="#1f2937" vertical={false} />
            <XAxis dataKey="range" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#030712', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {histogramData.map((d, i) => {
                const color = d.lo >= 70 ? '#ef4444' : d.lo >= 50 ? '#f97316' : d.lo >= 30 ? '#eab308' : '#6b7280';
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Time series */}
      {timeSeriesData.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="font-semibold mb-2">Transactions Over Time</h3>
          <p className="text-xs text-gray-500 mb-4">Volume per day, broken down by risk tier — surfaces timing patterns.</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#030712', border: '1px solid #374151', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="CRITICAL" stroke={TIER_FILL.CRITICAL} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="HIGH"     stroke={TIER_FILL.HIGH}     dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="MEDIUM"   stroke={TIER_FILL.MEDIUM}   dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="LOW"      stroke={TIER_FILL.LOW}      dot={false} strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Section: Transactions ────────────────────────────────────────

type SortKey = 'date' | 'vendor' | 'amount' | 'composite_risk';

function TransactionsSection({
  transactions, onSelect,
}: {
  transactions: AnalyzedTransaction[];
  onSelect: (t: AnalyzedTransaction) => void;
}) {
  const [filter, setFilter] = useState<RiskTier | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('composite_risk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const min = minAmount ? parseFloat(minAmount) : -Infinity;
    const max = maxAmount ? parseFloat(maxAmount) : Infinity;

    return transactions
      .filter((t) => {
        if (filter !== 'ALL' && t.risk_tier !== filter) return false;
        if (search) {
          const s = search.toLowerCase();
          if (!t.vendor.toLowerCase().includes(s) && !t.invoice_id.toLowerCase().includes(s)) return false;
        }
        if (t.amount < min || t.amount > max) return false;
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'amount' || sortKey === 'composite_risk') {
          cmp = (a[sortKey] as number) - (b[sortKey] as number);
        } else {
          cmp = String(a[sortKey]).localeCompare(String(b[sortKey]));
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [transactions, filter, search, minAmount, maxAmount, dateFrom, dateTo, sortKey, sortDir]);

  const counts = useMemo(() => ({
    ALL: transactions.length,
    CRITICAL: transactions.filter((t) => t.risk_tier === 'CRITICAL').length,
    HIGH: transactions.filter((t) => t.risk_tier === 'HIGH').length,
    MEDIUM: transactions.filter((t) => t.risk_tier === 'MEDIUM').length,
    LOW: transactions.filter((t) => t.risk_tier === 'LOW').length,
  }), [transactions]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }
  function sortIcon(k: SortKey) {
    if (sortKey !== k) return <span className="text-gray-700">↕</span>;
    return <span className="text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Transactions</h2>
        <p className="text-gray-400 text-sm mt-1">{filtered.length.toLocaleString()} shown — click any row for full detector findings.</p>
      </div>

      {/* Tier filters */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filter === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t !== 'ALL' && <span aria-hidden>{TIER_ICON[t as RiskTier]}</span>}
            {t} <span className="text-gray-500 font-normal">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input type="text" placeholder="Search vendor/invoice…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:col-span-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600" />
        <input type="number" placeholder="Min $" value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600" />
        <input type="number" placeholder="Max $" value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm placeholder-gray-600 focus:outline-none focus:border-blue-600" />
        <div className="flex gap-1">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-600" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-600" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 sticky top-0 z-10 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Invoice</th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-gray-200" onClick={() => toggleSort('date')}>
                  Date {sortIcon('date')}
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-gray-200" onClick={() => toggleSort('vendor')}>
                  Vendor {sortIcon('vendor')}
                </th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-gray-200" onClick={() => toggleSort('amount')}>
                  Amount {sortIcon('amount')}
                </th>
                <th className="px-4 py-3 text-left font-medium">Risk</th>
                <th className="px-4 py-3 text-left font-medium cursor-pointer hover:text-gray-200" onClick={() => toggleSort('composite_risk')}>
                  Score {sortIcon('composite_risk')}
                </th>
                <th className="px-4 py-3 text-left font-medium">Detectors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.slice(0, 500).map((txn) => (
                <tr
                  key={txn.invoice_id}
                  onClick={() => onSelect(txn)}
                  className="hover:bg-gray-900/70 cursor-pointer transition-colors"
                >
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

// ── Section: Vendors ─────────────────────────────────────────────

function VendorsSection({ transactions, onSelect }: {
  transactions: AnalyzedTransaction[];
  onSelect: (t: AnalyzedTransaction) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const vendors = useMemo(() => {
    const map = new Map<string, AnalyzedTransaction[]>();
    for (const t of transactions) {
      const list = map.get(t.vendor) ?? [];
      list.push(t);
      map.set(t.vendor, list);
    }
    return Array.from(map.entries())
      .map(([vendor, txns]) => {
        const sortedAmounts = txns.map((t) => t.amount).sort((a, b) => a - b);
        const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)] ?? 0;
        const flagged = txns.filter((t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL').length;
        const tiers: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        const maxTier = tiers.find((tier) => txns.some((t) => t.risk_tier === tier)) ?? 'LOW';
        return {
          vendor,
          txns,
          count: txns.length,
          totalSpend: txns.reduce((s, t) => s + t.amount, 0),
          median,
          avgScore: txns.reduce((s, t) => s + t.composite_risk, 0) / txns.length,
          flagged,
          maxTier,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vendors</h2>
        <p className="text-gray-400 text-sm mt-1">{vendors.length} vendors — sorted by average risk score. Click a row to expand.</p>
      </div>

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Transactions</th>
                <th className="px-4 py-3 text-left font-medium">Total Spend</th>
                <th className="px-4 py-3 text-left font-medium">Median</th>
                <th className="px-4 py-3 text-left font-medium">Avg Risk</th>
                <th className="px-4 py-3 text-left font-medium">Flagged</th>
                <th className="px-4 py-3 text-left font-medium">Max Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {vendors.slice(0, 100).map((v) => (
                <Fragment key={v.vendor}>
                  <tr
                    onClick={() => setExpanded(expanded === v.vendor ? null : v.vendor)}
                    className="hover:bg-gray-900/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <span className="text-gray-600 mr-2">{expanded === v.vendor ? '▼' : '▶'}</span>
                      {v.vendor}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{v.count}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(v.totalSpend)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-400">{fmt(v.median)}</td>
                    <td className="px-4 py-2.5 font-mono">{v.avgScore.toFixed(1)}</td>
                    <td className="px-4 py-2.5">
                      <span className={v.flagged > 0 ? 'text-orange-400 font-semibold' : 'text-gray-600'}>
                        {v.flagged}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><TierPill tier={v.maxTier} /></td>
                  </tr>
                  {expanded === v.vendor && (
                    <tr>
                      <td colSpan={7} className="bg-gray-950 px-6 py-4 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">Transactions for {v.vendor}</p>
                        <div className="space-y-1 max-h-80 overflow-y-auto">
                          {v.txns.sort((a, b) => b.composite_risk - a.composite_risk).map((t) => (
                            <div
                              key={t.invoice_id}
                              onClick={(e) => { e.stopPropagation(); onSelect(t); }}
                              className="grid grid-cols-[1fr_120px_120px_auto] gap-3 items-center px-3 py-2 rounded hover:bg-gray-900 cursor-pointer text-sm"
                            >
                              <span className="font-mono text-xs text-gray-500 truncate">{t.invoice_id}</span>
                              <span className="text-gray-400">{t.date}</span>
                              <span className="font-mono">{fmt(t.amount)}</span>
                              <TierPill tier={t.risk_tier} />
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {vendors.length > 100 && (
          <p className="text-center text-gray-600 text-xs py-3 border-t border-gray-800">
            Showing top 100 of {vendors.length} vendors
          </p>
        )}
      </div>
    </div>
  );
}

// ── Section: Benford ─────────────────────────────────────────────

function BenfordSection({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Benford&apos;s Law Analysis</h2>
        <p className="text-gray-400 text-sm mt-1">
          Natural transaction data follows Benford&apos;s distribution. Significant deviation may indicate manipulation.
        </p>
      </div>

      {([
        [result.benford_1st, BENFORD_1ST_CATEGORIES, 1] as const,
        [result.benford_2nd, BENFORD_2ND_CATEGORIES, 2] as const,
      ]).map(([b, cats, position]) => {
        const cat = categorizeMad(b.mad, position);
        const chartData = Object.keys(b.expected).map((digit) => ({
          digit,
          observed: b.observed[Number(digit)] ?? 0,
          expected: b.expected[Number(digit)] ?? 0,
        }));

        return (
          <div key={position} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">{position === 1 ? '1st' : '2nd'} Digit Distribution</h3>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                cat.color === 'emerald' ? 'bg-emerald-900/60 text-emerald-300' :
                cat.color === 'yellow' ? 'bg-yellow-900/60 text-yellow-300' :
                'bg-red-900/60 text-red-300'
              }`}>{cat.label}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">MAD</p>
                <p className="font-mono text-lg font-bold">{b.mad.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Chi-Square</p>
                <p className="font-mono text-lg font-bold">{b.chi_square.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Records</p>
                <p className="font-mono text-lg font-bold">{b.total_records}</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1f2937" vertical={false} />
                <XAxis dataKey="digit" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip contentStyle={{ background: '#030712', border: '1px solid #374151', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="observed" name="Observed" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expected" name="Expected (Benford)" fill="#fbbf24" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* MAD ranges table */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">MAD Conformity Ranges (Nigrini)</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {cats.map((c) => {
                  const isCurrent = c.label === cat.label;
                  return (
                    <div
                      key={c.label}
                      className={`rounded-lg p-3 border text-xs ${
                        isCurrent ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-gray-950'
                      }`}
                    >
                      <p className={`font-semibold ${
                        c.color === 'emerald' ? 'text-emerald-300' :
                        c.color === 'yellow' ? 'text-yellow-300' :
                        'text-red-300'
                      }`}>{c.label}</p>
                      <p className="font-mono text-gray-400 mt-1">{c.range}</p>
                      <p className="text-gray-500 mt-1 leading-tight">{c.description}</p>
                    </div>
                  );
                })}
              </div>
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
          }`}>{result.round_number.flagged ? 'FLAGGED' : 'NORMAL'}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Round count:</span> <span className="font-mono font-semibold ml-2">{result.round_number.round_count}</span></div>
          <div><span className="text-gray-500">Rate:</span> <span className="font-mono font-semibold ml-2">{pct(result.round_number.round_rate)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Section: Detectors ───────────────────────────────────────────

function DetectorsSection({ transactions }: { transactions: AnalyzedTransaction[] }) {
  const detectorNames: DetectorName[] = [
    'BENFORD_1ST', 'BENFORD_2ND', 'ROUND_NUMBER', 'ISOLATION_FOREST',
    'RSF', 'EXACT_DUPLICATE', 'FUZZY_DUPLICATE', 'SPLIT_INVOICE', 'DESCRIPTION_AUDIT',
  ];

  const data = detectorNames.map((d) => ({
    name: DETECTOR_INFO[d].name,
    detectorKey: d,
    count: transactions.filter((t) => t.triggered_detectors.includes(d)).length,
  }));
  data.sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Detectors</h2>
        <p className="text-gray-400 text-sm mt-1">How many transactions each detector flagged. Hover the ⓘ for methodology.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid stroke="#1f2937" horizontal={false} />
            <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fontSize: 11 }} width={150} />
            <Tooltip contentStyle={{ background: '#030712', border: '1px solid #374151', borderRadius: 8 }} />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {detectorNames.map((d) => {
          const info = DETECTOR_INFO[d];
          const count = transactions.filter((t) => t.triggered_detectors.includes(d)).length;
          const rate = transactions.length > 0 ? count / transactions.length : 0;
          return (
            <div key={d} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm">{info.name}</p>
                <InfoTooltip content={info.long}>
                  <span className="text-gray-600 hover:text-gray-300 cursor-help text-sm">ⓘ</span>
                </InfoTooltip>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-snug">{info.short}</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-bold tabular-nums">{count}</span>
                <span className="text-xs text-gray-500">{pct(rate)} of txns</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Layout ──────────────────────────────────────────────────

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [section, setSection] = useState<Section>('upload');
  const [drawerTxn, setDrawerTxn] = useState<AnalyzedTransaction | null>(null);

  const handleDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setProgress({ step: 0, total: 10, label: 'Reading file…' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const mapping = autoDetectMapping(text);
        const parsed = parseCsv(text, mapping);
        if (parsed.transactions.length === 0) {
          setError('No valid transactions found. Ensure the CSV has a numeric column.');
          setProgress(null);
          return;
        }
        const r = await runForensicAnalysisAsync(parsed.transactions, setProgress);
        setResult(r);
        setProgress(null);
        setSection('overview');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed.');
        setProgress(null);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleExport = useCallback(() => {
    if (result) exportRiskReport(result);
  }, [result]);

  // Close drawer with Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerTxn(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <LoadingOverlay progress={progress} />
      <DetailDrawer txn={drawerTxn} onClose={() => setDrawerTxn(null)} />

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
                {item.label}
              </button>
            );
          })}
        </nav>
        {result && (
          <div className="px-4 py-4 border-t border-gray-800 space-y-2">
            <div className={`text-xs font-semibold px-2 py-1.5 rounded text-center ${TIER_BADGE[result.portfolio.tier]}`}>
              {result.portfolio.tier} · {result.portfolio.score.toFixed(0)}/100
            </div>
            <button
              onClick={handleExport}
              className="w-full text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded transition-colors"
            >
              ↓ Export Report
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-10">
          {section === 'upload' && (
            <UploadSection onDrop={handleDrop} error={error} hasResult={!!result} />
          )}
          {section === 'overview' && result && <OverviewSection result={result} onExport={handleExport} />}
          {section === 'transactions' && result && <TransactionsSection transactions={result.transactions} onSelect={setDrawerTxn} />}
          {section === 'vendors' && result && <VendorsSection transactions={result.transactions} onSelect={setDrawerTxn} />}
          {section === 'benford' && result && <BenfordSection result={result} />}
          {section === 'detectors' && result && <DetectorsSection transactions={result.transactions} />}
        </div>
      </main>
    </div>
  );
}
