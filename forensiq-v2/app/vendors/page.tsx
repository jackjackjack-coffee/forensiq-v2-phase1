'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { RiskBadge } from '@/components/ui/RiskBadge';
import { StatsCard } from '@/components/ui/StatsCard';
import { TransactionTable } from '@/components/ui/TransactionTable';
import { getAnalysisResult } from '@/lib/analysis-store';
import { adaptTransaction } from '@/lib/adapt-transaction';
import type { AnalysisResult, AnalyzedTransaction, RiskTier } from '@/lib/types/transaction';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';
function toRiskLevel(tier: RiskTier): RiskLevel {
  const map: Record<RiskTier, RiskLevel> = {
    CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low',
  };
  return map[tier];
}

const BORDER: Record<RiskTier, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-amber-500',
  MEDIUM: 'border-l-yellow-500',
  LOW: 'border-l-green-500',
};

export default function VendorsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setResult(getAnalysisResult());
  }, []);

  const vendors = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, AnalyzedTransaction[]>();
    for (const t of result.transactions) {
      const list = map.get(t.vendor) ?? [];
      list.push(t);
      map.set(t.vendor, list);
    }
    return Array.from(map.entries())
      .map(([vendor, txns]) => {
        const sorted = txns.map((t) => t.amount).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const flagged = txns.filter((t) => t.risk_tier === 'HIGH' || t.risk_tier === 'CRITICAL').length;
        const tiers: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        const maxTier = tiers.find((tier) => txns.some((t) => t.risk_tier === tier)) ?? 'LOW';
        return {
          vendor, txns, count: txns.length,
          totalSpend: txns.reduce((s, t) => s + t.amount, 0),
          median, flagged, maxTier,
          avgScore: txns.reduce((s, t) => s + t.composite_risk, 0) / txns.length,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [result]);

  const totalFlagged = useMemo(() => vendors.reduce((s, v) => s + v.flagged, 0), [vendors]);
  const totalSpend = useMemo(() => vendors.reduce((s, v) => s + v.totalSpend, 0), [vendors]);

  if (!result) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-slate-400 text-sm">
          No analysis data.{' '}
          <a href="/" className="text-cyan-400 hover:underline">Upload a file</a> to get started.
        </p>
      </div>
    );
  }

  const TH = 'px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-500';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold">Vendors</h1>
      <p className="text-sm text-slate-400 -mt-3">
        {vendors.length} vendors — sorted by average risk score. Click a row to expand.
      </p>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatsCard
          label="TOTAL VENDORS"
          value={vendors.length.toString()}
          valueClassName="text-white"
          subtitle="Unique payees"
        />
        <StatsCard
          label="FLAGGED VENDORS"
          value={vendors.filter((v) => v.flagged > 0).length.toString()}
          valueClassName="text-amber-400"
          subtitle={`${totalFlagged} flagged transactions`}
        />
        <StatsCard
          label="TOTAL SPEND"
          value={fmt(totalSpend)}
          valueClassName="text-white"
          subtitle="Across all vendors"
        />
      </div>

      {/* Vendor table */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/80">
              <tr>
                <th className={TH}>Vendor</th>
                <th className={TH}>Transactions</th>
                <th className={TH}>Total Spend</th>
                <th className={TH}>Median</th>
                <th className={TH}>Avg Risk</th>
                <th className={TH}>Flagged</th>
                <th className={TH}>Max Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {vendors.slice(0, 100).map((v) => (
                <Fragment key={v.vendor}>
                  <tr
                    onClick={() => setExpanded(expanded === v.vendor ? null : v.vendor)}
                    className={`border-l-[3px] ${BORDER[v.maxTier]} cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50`}
                  >
                    <td className="pl-3 pr-4 py-2.5 font-medium text-gray-800 dark:text-slate-200">
                      <span className="text-slate-600 mr-2">{expanded === v.vendor ? '▼' : '▶'}</span>
                      {v.vendor}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 dark:text-slate-400">{v.count}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-800 dark:text-slate-200">{fmt(v.totalSpend)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-slate-400">{fmt(v.median)}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-800 dark:text-slate-200">{v.avgScore.toFixed(1)}</td>
                    <td className="px-4 py-2.5">
                      <span className={v.flagged > 0 ? 'text-amber-500 dark:text-amber-400 font-semibold' : 'text-gray-300 dark:text-slate-600'}>
                        {v.flagged}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <RiskBadge level={toRiskLevel(v.maxTier)} />
                    </td>
                  </tr>
                  {expanded === v.vendor && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50 dark:bg-slate-950 px-6 py-4 border-t border-gray-200 dark:border-slate-800">
                        <p className="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-3">
                          Transactions for {v.vendor}
                        </p>
                        <TransactionTable
                          transactions={v.txns
                            .sort((a, b) => b.composite_risk - a.composite_risk)
                            .map(adaptTransaction)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {vendors.length > 100 && (
          <p className="text-center text-gray-400 dark:text-slate-600 text-xs py-3 border-t border-gray-200 dark:border-slate-700">
            Showing top 100 of {vendors.length} vendors
          </p>
        )}
      </div>
    </div>
  );
}
