'use client';

import { useState, useEffect, useMemo } from 'react';
import { StatsCard } from '@/components/ui/StatsCard';
import { TransactionTable } from '@/components/ui/TransactionTable';
import { getAnalysisResult } from '@/lib/analysis-store';
import { adaptTransaction } from '@/lib/adapt-transaction';
import type { AnalysisResult } from '@/lib/types/transaction';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtK = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : fmt(n));
const pctInt = (n: number) => `${Math.round(n * 100)}%`;

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

  const recentTransactions = useMemo(
    () =>
      result
        ? [...result.transactions]
            .sort((a, b) => b.composite_risk - a.composite_risk)
            .slice(0, 10)
            .map(adaptTransaction)
        : [],
    [result],
  );

  if (!result) return <EmptyState />;

  const p = result.portfolio;
  const tierLabel = p.tier.charAt(0) + p.tier.slice(1).toLowerCase() + ' tier';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 bg-gray-50 dark:bg-slate-900 min-h-screen text-gray-900 dark:text-white">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatsCard
          label="PORTFOLIO RISK"
          value={`${p.score.toFixed(0)}/100`}
          valueClassName="text-red-400"
          subtitle={tierLabel}
        />
        <StatsCard
          label="FLAGGED"
          value={p.flagged_transactions.toString()}
          valueClassName="text-amber-400"
          subtitle={`of ${p.total_transactions.toLocaleString()} total`}
        />
        <StatsCard
          label="EXPOSURE"
          value={fmtK(p.estimated_exposure)}
          valueClassName="text-amber-400"
          subtitle="Estimated value"
        />
        <StatsCard
          label="OUTLIER RATE"
          value={pctInt(p.outlier_rate)}
          valueClassName="text-amber-400"
          subtitle={p.outlier_rate > 0.05 ? 'Above threshold' : 'Within normal range'}
        />
        <StatsCard
          label="TOP VENDOR"
          value={topVendor.vendor}
          valueClassName="text-white"
          subtitle={topVendor.count > 0 ? `${topVendor.count} flags this period` : 'No flagged vendors'}
        />
      </div>

      {/* Alert banner */}
      {criticalCount > 0 && (
        <div className="border-l-4 border-amber-500 bg-amber-950/30 rounded-r-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-400 mt-0.5 shrink-0">⚠</span>
          <p className="text-sm text-amber-200">
            {pctInt(p.outlier_rate)} of transactions show unusual patterns — review{' '}
            <strong className="text-amber-400 font-bold">
              {criticalCount} critical item{criticalCount !== 1 ? 's' : ''}
            </strong>{' '}
            before approving payment.
          </p>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
          Recent Transactions
        </h2>
        <TransactionTable transactions={recentTransactions} />
      </div>
    </div>
  );
}
