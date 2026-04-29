'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { StatsCard } from '@/components/ui/StatsCard';
import { getAnalysisResult } from '@/lib/analysis-store';
import { DETECTOR_INFO } from '@/lib/detector-info';
import type { AnalysisResult, DetectorName } from '@/lib/types/transaction';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtK = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : fmt(n));
const pctInt = (n: number) => `${Math.round(n * 100)}%`;

const DETECTOR_NAMES: DetectorName[] = [
  'EXACT_DUPLICATE', 'RSF', 'ISOLATION_FOREST', 'SPLIT_INVOICE',
  'ROUND_NUMBER', 'DESCRIPTION_AUDIT', 'BENFORD_1ST', 'FUZZY_DUPLICATE', 'BENFORD_2ND',
];

const TIER_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

function EmptyState() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20 text-center">
      <p className="text-slate-400 text-sm">
        No analysis data.{' '}
        <a href="/" className="text-cyan-400 hover:underline">
          Upload a file
        </a>{' '}
        to get started.
      </p>
    </div>
  );
}

export default function OverviewPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    setResult(getAnalysisResult());
  }, []);

  const topVendor = useMemo(() => {
    if (!result) return { vendor: '—', count: 0 };
    const map = new Map<string, number>();
    for (const t of result.transactions) {
      if (t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL') {
        map.set(t.vendor, (map.get(t.vendor) ?? 0) + 1);
      }
    }
    let best = { vendor: '—', count: 0 };
    for (const [vendor, count] of map) {
      if (count > best.count) best = { vendor, count };
    }
    return best;
  }, [result]);

  const criticalCount = useMemo(
    () => result?.transactions.filter((t) => t.risk_tier === 'CRITICAL').length ?? 0,
    [result],
  );

  // Top 3 detectors by flag count for "why risky" section
  const topDetectors = useMemo(() => {
    if (!result) return [];
    return DETECTOR_NAMES
      .map((d) => ({
        d,
        count: result.transactions.filter((t) => t.triggered_detectors.includes(d)).length,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [result]);

  // Risk score distribution histogram (buckets: 0-10, 10-20, …, 90-100)
  const scoreHistogram = useMemo(() => {
    if (!result) return [];
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}–${i * 10 + 10}`,
      count: 0,
    }));
    for (const t of result.transactions) {
      const idx = Math.min(Math.floor(t.composite_risk / 10), 9);
      buckets[idx]!.count++;
    }
    return buckets;
  }, [result]);

  // Transactions over time — group by month, split by tier
  const timeSeries = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, Record<string, number>>();
    for (const t of result.transactions) {
      const month = t.date.slice(0, 7); // "YYYY-MM"
      if (!map.has(month)) map.set(month, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
      const entry = map.get(month)!;
      entry[t.risk_tier] = (entry[t.risk_tier] ?? 0) + 1;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, tiers]) => ({ month, ...tiers }));
  }, [result]);

  if (!result) return <EmptyState />;

  const p = result.portfolio;
  const tierLabel = p.tier.charAt(0) + p.tier.slice(1).toLowerCase() + ' tier';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 bg-gray-50 dark:bg-slate-950 min-h-screen text-gray-900 dark:text-white">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatsCard
          label="PORTFOLIO RISK"
          value={`${p.score.toFixed(0)}/100`}
          valueClassName="text-red-500 dark:text-red-400"
          subtitle={tierLabel}
        />
        <StatsCard
          label="FLAGGED"
          value={p.flagged_transactions.toString()}
          valueClassName="text-amber-500 dark:text-amber-400"
          subtitle={`of ${p.total_transactions.toLocaleString()} total`}
        />
        <StatsCard
          label="EXPOSURE"
          value={fmtK(p.estimated_exposure)}
          valueClassName="text-amber-500 dark:text-amber-400"
          subtitle="Estimated value"
        />
        <StatsCard
          label="OUTLIER RATE"
          value={pctInt(p.outlier_rate)}
          valueClassName="text-amber-500 dark:text-amber-400"
          subtitle={p.outlier_rate > 0.05 ? 'Above threshold' : 'Within normal range'}
        />
        <StatsCard
          label="TOP VENDOR"
          value={topVendor.vendor}
          valueClassName="text-gray-900 dark:text-white"
          subtitle={topVendor.count > 0 ? `${topVendor.count} flags this period` : 'No flagged vendors'}
        />
      </div>

      {/* Alert banner */}
      {criticalCount > 0 && (
        <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 rounded-r-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {pctInt(p.outlier_rate)} of transactions show unusual patterns — review{' '}
            <strong className="text-amber-600 dark:text-amber-400 font-bold">
              {criticalCount} critical item{criticalCount !== 1 ? 's' : ''}
            </strong>{' '}
            before approving payment.
          </p>
        </div>
      )}

      {/* Why is this portfolio risky? */}
      {topDetectors.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Why is this portfolio risky?
          </h2>
          <div className="space-y-3">
            {topDetectors.map(({ d, count }) => {
              const info = DETECTOR_INFO[d];
              return (
                <div key={d} className="flex items-start gap-4 rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60 px-4 py-3">
                  <div className="shrink-0 mt-0.5 w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{count}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">{info.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-snug">{info.short}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Risk score distribution */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Risk Score Distribution</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">
          Number of transactions in each risk score bucket (0–100).
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={scoreHistogram} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" className="dark:[stroke:#1e293b]" vertical={false} />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
              labelStyle={{ color: '#64748b' }}
            />
            <Bar dataKey="count" name="Transactions" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transactions over time */}
      {timeSeries.length > 1 && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Transactions Over Time</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">
            Monthly transaction count by risk tier.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={timeSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
                labelStyle={{ color: '#64748b' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((tier) => (
                <Line
                  key={tier}
                  type="monotone"
                  dataKey={tier}
                  stroke={TIER_COLOR[tier]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
