'use client';

import { useState, useEffect, useMemo } from 'react';
import { TransactionTable } from '@/components/ui/TransactionTable';
import { getAnalysisResult } from '@/lib/analysis-store';
import { adaptTransaction, type TableTransaction } from '@/lib/adapt-transaction';
import type { AnalysisResult, RiskTier } from '@/lib/types/transaction';

type SortKey = 'date' | 'vendor' | 'amount' | 'composite_risk';

export default function TransactionsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [filter, setFilter] = useState<RiskTier | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('composite_risk');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    setResult(getAnalysisResult());
  }, []);

  const filtered = useMemo(() => {
    if (!result) return [];
    const min = minAmount ? parseFloat(minAmount) : -Infinity;
    const max = maxAmount ? parseFloat(maxAmount) : Infinity;
    return result.transactions
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
  }, [result, filter, search, minAmount, maxAmount, dateFrom, dateTo, sortKey, sortDir]);

  const counts = useMemo(() => ({
    ALL: result?.transactions.length ?? 0,
    CRITICAL: result?.transactions.filter((t) => t.risk_tier === 'CRITICAL').length ?? 0,
    HIGH: result?.transactions.filter((t) => t.risk_tier === 'HIGH').length ?? 0,
    MEDIUM: result?.transactions.filter((t) => t.risk_tier === 'MEDIUM').length ?? 0,
    LOW: result?.transactions.filter((t) => t.risk_tier === 'LOW').length ?? 0,
  }), [result]);

  const pageSlice: TableTransaction[] = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(adaptTransaction),
    [filtered, page],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }

  const inputCls =
    'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500';

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-5 bg-gray-50 dark:bg-slate-900 min-h-screen text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <p className="text-sm text-slate-400 -mt-3">
        {filtered.length.toLocaleString()} shown — click any row for full detector findings.
      </p>

      {/* Tier filter buttons */}
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setFilter(t); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === t
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {t} <span className="opacity-60">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          type="text" placeholder="Search vendor / invoice…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`md:col-span-2 ${inputCls}`}
        />
        <input
          type="number" placeholder="Min $" value={minAmount}
          onChange={(e) => { setMinAmount(e.target.value); setPage(1); }}
          className={inputCls}
        />
        <input
          type="number" placeholder="Max $" value={maxAmount}
          onChange={(e) => { setMaxAmount(e.target.value); setPage(1); }}
          className={inputCls}
        />
        <div className="flex gap-1">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className={`flex-1 min-w-0 ${inputCls}`} />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className={`flex-1 min-w-0 ${inputCls}`} />
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        <span>Sort by:</span>
        {(['composite_risk', 'amount', 'date', 'vendor'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => toggleSort(k)}
            className={`px-2 py-0.5 rounded border transition-colors ${
              sortKey === k
                ? 'border-cyan-500 text-cyan-400'
                : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            {k.replace('_', ' ')} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
          </button>
        ))}
      </div>

      <TransactionTable transactions={pageSlice} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Page {page} of {totalPages} ({filtered.length.toLocaleString()} results)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)} disabled={page === 1}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(page + 1)} disabled={page === totalPages}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-700 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
