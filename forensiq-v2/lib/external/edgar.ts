// lib/external/edgar.ts
// ─────────────────────────────────────────────────────────────────
// SEC EDGAR company search — cross-references vendor names against
// SEC-registered entities. No API key required.
// All calls go through the Supabase Edge Function proxy — no credentials
// in client-side code under any circumstances.
// ─────────────────────────────────────────────────────────────────

import type { EdgarSearchResult } from '../types/transaction';

const EDGAR_BASE = 'https://efts.sec.gov/LATEST/search-index?q=%22{QUERY}%22&dateRange=custom&startdt=2015-01-01&category=form-type';
const EDGAR_COMPANY_SEARCH = 'https://www.sec.gov/cgi-bin/browse-edgar?company={QUERY}&CIK=&type=&dateb=&owner=include&count=10&search_text=&action=getcompany&output=atom';

/**
 * SEC EDGAR Vendor Verification
 *
 * Accounting basis: Legitimate vendors billing significant amounts should
 * appear in public business records. Fictitious / shell company vendors
 * often have no verifiable corporate existence.
 *
 * EDGAR covers all SEC-registered entities (public companies, investment
 * advisors, broker-dealers). While not all legitimate private vendors file
 * with the SEC, high-dollar consulting firms and IT vendors frequently do.
 *
 * Red flag: A vendor billing $500,000+ for "consulting services" that has
 * no SEC filings and no public corporate record warrants further investigation.
 *
 * Standard: ACFE Fraud Examiners Manual — Vendor Fraud chapter.
 * Free API: data.sec.gov — no key required, no rate limit for reasonable use.
 *
 * NOTE: This function is called from the Supabase Edge Function proxy,
 * not directly from the browser.
 *
 * @param vendorName - Exact vendor name as it appears in the ledger
 * @returns EDGAR search result with match confidence
 */
export async function checkEdgar(vendorName: string): Promise<EdgarSearchResult> {
  const encoded = encodeURIComponent(vendorName.replace(/['"]/g, ''));
  const url = EDGAR_COMPANY_SEARCH.replace('{QUERY}', encoded);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ForensiQ-Portfolio-Tool forensiq@example.com' },
    });

    if (!response.ok) {
      return { cik: '', entity_name: vendorName, matched: false, confidence: 0 };
    }

    const text = await response.text();

    // Parse Atom feed — look for <company-name> entries
    const matches = text.match(/<company-name>(.*?)<\/company-name>/gi) ?? [];
    const entityNames = matches.map((m) =>
      m.replace(/<\/?company-name>/gi, '').trim()
    );

    if (entityNames.length === 0) {
      return { cik: '', entity_name: vendorName, matched: false, confidence: 0 };
    }

    // Find closest match using token overlap
    const best = findBestMatch(vendorName, entityNames);

    return {
      cik: '', // CIK not extracted in this simplified version
      entity_name: best.match,
      matched: best.score >= 0.7,
      confidence: best.score,
    };
  } catch {
    return { cik: '', entity_name: vendorName, matched: false, confidence: 0 };
  }
}

// ── Token overlap similarity ──────────────────────────────────────

function findBestMatch(
  query: string,
  candidates: string[]
): { match: string; score: number } {
  const qTokens = tokenize(query);
  let best = { match: candidates[0] ?? '', score: 0 };

  for (const candidate of candidates) {
    const cTokens = tokenize(candidate);
    const intersection = qTokens.filter((t) => cTokens.includes(t)).length;
    const union = new Set([...qTokens, ...cTokens]).size;
    const score = union > 0 ? intersection / union : 0;
    if (score > best.score) best = { match: candidate, score };
  }

  return best;
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'inc', 'llc', 'ltd', 'corp', 'co', 'company',
  'group', 'services', 'solutions', 'management', 'associates',
]);
