'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getAnalysisResult } from '@/lib/analysis-store';
import { categorizeMad, BENFORD_1ST_CATEGORIES, BENFORD_2ND_CATEGORIES, type MadCategory } from '@/lib/benford-categories';
import type { AnalysisResult } from '@/lib/types/transaction';

export default function BenfordPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    setResult(getAnalysisResult());
  }, []);

  const charts = useMemo(() => {
    if (!result) return [];
    return [
      { b: result.benford_1st, cats: BENFORD_1ST_CATEGORIES, position: 1 as const, label: '1st Digit' },
      { b: result.benford_2nd, cats: BENFORD_2ND_CATEGORIES, position: 2 as const, label: '2nd Digit' },
    ].map(({ b, cats, position, label }) => {
      const cat = categorizeMad(b.mad, position);
      const isPass = cat.label === cats[0]?.label; // ACCEPTABLE / CLOSE TO ACCEPTABLE
      const chartData = Object.keys(b.expected).map((digit) => ({
        digit,
        Expected: parseFloat((b.expected[Number(digit)] ?? 0).toFixed(2)),
        Actual: parseFloat((b.observed[Number(digit)] ?? 0).toFixed(2)),
      }));
      return { b, cats, cat, isPass, chartData, label, position };
    });
  }, [result]);

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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8 bg-gray-50 dark:bg-slate-950 min-h-screen text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold">Benford Analysis</h1>
      <p className="text-sm text-slate-400 -mt-3">
        Natural transaction data follows Benford&apos;s distribution. Significant deviation may indicate manipulation.
      </p>

      {charts.map(({ b, cats, cat, isPass, chartData, label }) => (
        <div
          key={label}
          className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{label} Distribution</h2>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                isPass ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
              }`}
            >
              {isPass ? 'PASS' : 'FAIL'} — {cat.label}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-700 p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-1">MAD</p>
              <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{b.mad.toFixed(4)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-700 p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-1">Chi-Square</p>
              <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{b.chi_square.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-700 p-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-1">Records</p>
              <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{b.total_records.toLocaleString()}</p>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="digit" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
                labelStyle={{ color: '#64748b' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Expected" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Actual" fill="#fb923c" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Conformity badge */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-2">Conformity</p>
            <span
              className={`inline-block text-sm font-semibold px-3 py-1 rounded-full ${
                isPass ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'
              }`}
            >
              {cat.label}
            </span>
            <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">{cat.description ?? ''}</p>
          </div>

          {/* MAD conformity ranges table */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-2">
              MAD Conformity Ranges (Nigrini)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {cats.map((c: MadCategory) => {
                const isCurrent = c.label === cat.label;
                return (
                  <div
                    key={c.label}
                    className={`rounded-lg p-3 border text-xs ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950'
                    }`}
                  >
                    <p className={`font-semibold ${
                      c.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-300' :
                      c.color === 'yellow'  ? 'text-yellow-600 dark:text-yellow-300'  :
                                             'text-red-600 dark:text-red-300'
                    }`}>{c.label}</p>
                    <p className="font-mono text-gray-500 dark:text-slate-400 mt-1">{c.range}</p>
                    <p className="text-gray-500 dark:text-slate-500 mt-1 leading-tight">{c.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Round numbers */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Round Number Analysis</h2>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              result.round_number.flagged ? 'bg-red-900 text-red-400' : 'bg-green-900 text-green-400'
            }`}
          >
            {result.round_number.flagged ? 'FAIL' : 'PASS'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-700 p-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-1">Round Count</p>
            <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{result.round_number.round_count}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 dark:bg-slate-950 dark:border-slate-700 p-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-slate-500 mb-1">Rate</p>
            <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">
              {(result.round_number.round_rate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
