'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getAnalysisResult } from '@/lib/analysis-store';
import { DETECTOR_INFO } from '@/lib/detector-info';
import type { AnalysisResult, DetectorName } from '@/lib/types/transaction';

const DETECTOR_NAMES: DetectorName[] = [
  'BENFORD_1ST', 'BENFORD_2ND', 'ROUND_NUMBER', 'ISOLATION_FOREST',
  'RSF', 'EXACT_DUPLICATE', 'FUZZY_DUPLICATE', 'SPLIT_INVOICE', 'DESCRIPTION_AUDIT',
];

export default function DetectorsPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [enabled, setEnabled] = useState<Record<DetectorName, boolean>>(
    Object.fromEntries(DETECTOR_NAMES.map((d) => [d, true])) as Record<DetectorName, boolean>,
  );
  const [tooltip, setTooltip] = useState<DetectorName | null>(null);

  useEffect(() => {
    setResult(getAnalysisResult());
  }, []);

  const detectorStats = useMemo(() => {
    if (!result) return [];
    return DETECTOR_NAMES.map((d) => {
      const count = result.transactions.filter((t) => t.triggered_detectors.includes(d)).length;
      const rate = result.transactions.length > 0 ? count / result.transactions.length : 0;
      const isPassing = count === 0;
      return { d, count, rate, isPassing };
    });
  }, [result]);

  const chartData = useMemo(
    () =>
      detectorStats
        .filter((s) => enabled[s.d])
        .map((s) => ({ name: DETECTOR_INFO[s.d].name, count: s.count, isPassing: s.isPassing }))
        .sort((a, b) => b.count - a.count),
    [detectorStats, enabled],
  );

  function toggleEnabled(d: DetectorName) {
    setEnabled((prev) => ({ ...prev, [d]: !prev[d] }));
  }

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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold">Detectors</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 -mt-3">
        How many transactions each detector flagged. Toggle detectors to include or exclude them.
      </p>

      {/* Horizontal bar chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-widest">
            Flag Counts (enabled detectors)
          </h2>
          <ResponsiveContainer width="100%" height={chartData.length * 40 + 20}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid stroke="#f1f5f9" className="dark:[stroke:#1e293b]" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
              />
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }}
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
              />
              <Bar dataKey="count" name="Flagged" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isPassing ? '#22c55e' : '#f97316'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detector cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectorStats.map(({ d, count, rate, isPassing }) => {
          const info = DETECTOR_INFO[d];
          const isOn = enabled[d];
          const showTooltip = tooltip === d;
          return (
            <div
              key={d}
              className="bg-white border border-gray-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-gray-900 dark:text-white">{info.name}</p>
                    {/* ⓘ tooltip trigger */}
                    <div className="relative">
                      <button
                        onMouseEnter={() => setTooltip(d)}
                        onMouseLeave={() => setTooltip(null)}
                        onFocus={() => setTooltip(d)}
                        onBlur={() => setTooltip(null)}
                        className="w-4 h-4 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors shrink-0"
                        aria-label={`Info about ${info.name}`}
                      >
                        i
                      </button>
                      {showTooltip && (
                        <div className="absolute z-20 left-6 top-0 w-64 rounded-lg bg-gray-900 dark:bg-slate-800 border border-gray-700 dark:border-slate-700 p-3 shadow-xl text-xs text-gray-200 dark:text-slate-200 leading-relaxed">
                          <p className="font-semibold mb-1 text-white">{info.name}</p>
                          <p className="mb-2">{info.long}</p>
                          <p className="text-gray-500 dark:text-slate-500 italic">{info.basis}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 leading-snug">{info.short}</p>
                </div>
                {/* Toggle */}
                <button
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => toggleEnabled(d)}
                  className={`w-9 h-5 rounded-full relative transition-colors shrink-0 mt-0.5 ${
                    isOn ? 'bg-cyan-600' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      isOn ? 'left-4' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xl font-bold tabular-nums ${count > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                  {count}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-slate-500">{(rate * 100).toFixed(1)}% of txns</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isPassing
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400'
                    }`}
                  >
                    {isPassing ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
