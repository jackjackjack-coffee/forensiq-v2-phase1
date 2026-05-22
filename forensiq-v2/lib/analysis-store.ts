import type { AnalysisResult } from './types/transaction';
import pako from 'pako';

const KEY = 'forensiq_analysis_result';

// Chunked base64 encode — avoids "Maximum call stack" errors that
// String.fromCharCode(...bytes) throws for arrays larger than ~65k elements.
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)) as number[],
    );
  }
  return btoa(binary);
}

// In-memory cache for the current session — survives navigation since this
// module instance is shared across pages. Belt-and-suspenders against the
// 5 MB localStorage quota that 9k+ transaction analyses can blow through.
let memoryCurrent: AnalysisResult | null = null;

export function setAnalysisResult(result: AnalysisResult): void {
  memoryCurrent = result;
  if (typeof window === 'undefined') return;
  try {
    const json = JSON.stringify(result);
    const compressed = pako.gzip(json);
    const b64 = uint8ToBase64(compressed);
    localStorage.setItem(KEY, b64);
  } catch {
    // Quota exceeded or unavailable — memoryCurrent still serves this session.
  }
}

export function getAnalysisResult(): AnalysisResult | null {
  if (memoryCurrent) return memoryCurrent;
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return null;
    // Try compressed format first
    try {
      const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
      const json = pako.ungzip(bytes, { to: 'string' });
      const parsed = JSON.parse(json) as AnalysisResult;
      memoryCurrent = parsed;
      return parsed;
    } catch {
      // Fallback: legacy uncompressed JSON
      const parsed = JSON.parse(stored) as AnalysisResult;
      memoryCurrent = parsed;
      return parsed;
    }
  } catch {
    return null;
  }
}
