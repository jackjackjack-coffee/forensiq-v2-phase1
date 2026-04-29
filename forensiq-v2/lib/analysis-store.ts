import type { AnalysisResult } from './types/transaction';

const KEY = 'forensiq_analysis_result';

export function setAnalysisResult(result: AnalysisResult): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function getAnalysisResult(): AnalysisResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as AnalysisResult) : null;
  } catch {
    return null;
  }
}
