'use client';

import { useState, useEffect, useMemo } from 'react';
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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 bg-gray-50 dark:bg-slate-900 min-h-screen text-gray-900 dark:text-white">
      <h1 className="text-2xl font-bold">Detectors</h1>
      <p className="text-sm text-slate-400 -mt-3">
        How many transactions each detector flagged. Toggle detectors to include or exclude them.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {detectorStats.map(({ d, count, rate, isPassing }) => {
          const info = DETECTOR_INFO[d];
          const isOn = enabled[d];
          return (
            <div
              key={d}
              className="bg-slate-800 border border-slate-700 dark:bg-slate-800 dark:border-slate-700 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{info.name}</p>
                  <p className="text-sm text-slate-400 mt-1 leading-snug">{info.short}</p>
                </div>
                {/* Toggle */}
                <button
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => toggleEnabled(d)}
                  className={`w-9 h-5 rounded-full relative transition-colors shrink-0 mt-0.5 ${
                    isOn ? 'bg-cyan-600' : 'bg-slate-600'
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
                <span className={`text-xl font-bold tabular-nums ${count > 0 ? 'text-amber-400' : 'text-white'}`}>
                  {count}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{(rate * 100).toFixed(1)}% of txns</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      isPassing ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
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
