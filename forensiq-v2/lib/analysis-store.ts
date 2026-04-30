import type { AnalysisResult } from './types/transaction';

const KEY = 'forensiq_analysis_result';

export function setAnalysisResult(result: AnalysisResult): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    // localStorage full or unavailable
  }
}

export function getAnalysisResult(): AnalysisResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as AnalysisResult) : null;
  } catch {
    return null;
  }
}
