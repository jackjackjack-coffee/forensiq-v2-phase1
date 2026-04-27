// lib/external/ofac.ts
// ─────────────────────────────────────────────────────────────────
// OFAC SDN (Specially Designated Nationals) sanctions list checker.
// Downloads the official US Treasury XML list and performs fuzzy
// name matching against vendor names in the ledger.
// No API key required. Called from Supabase Edge Function.
// ─────────────────────────────────────────────────────────────────

import type { OfacCheckResult } from '../types/transaction';

// OFAC provides a free JSON feed — no auth required
const OFAC_SDN_JSON = 'https://www.treasury.gov/ofac/downloads/sdn.xml';
// Lightweight consolidated list (faster for demo use)
const OFAC_CONSOLIDATED = 'https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml';

interface SdnEntry {
  name: string;
  list_type: string;
  aliases: string[];
}

// In-memory cache — refreshed once per Edge Function cold start
let sdnCache: SdnEntry[] | null = null;

/**
 * OFAC SDN Sanctions Screening
 *
 * Accounting basis: Payments to OFAC-sanctioned entities expose the
 * organization to civil and criminal penalties regardless of intent.
 * Compliance screening is required by the Bank Secrecy Act and
 * implemented in virtually all corporate AP (accounts payable) systems.
 *
 * Forensic accounting relevance: OFAC hits in a ledger may indicate:
 * - Payments deliberately routed through sanctioned intermediaries
 * - Compromised vendor master file (shell company inserted by insider)
 * - Inadequate onboarding controls for new vendors
 *
 * Fuzzy matching (Levenshtein distance ≤ 2) catches:
 * - Deliberate misspellings to evade exact-match filters
 * - Transliteration variations of sanctioned entity names
 *
 * Standard: ACFE Fraud Examiners Manual — Corruption chapter.
 * US Treasury OFAC: 31 CFR Parts 500–598 — Sanctions Regulations.
 * Free source: US Treasury SDN list (updated monthly).
 *
 * NOTE: Called from Supabase Edge Function only — never from client.
 *
 * @param vendorNames - Array of unique vendor names to screen
 * @returns Per-vendor OFAC screening results
 */
export async function checkOfacBatch(vendorNames: string[]): Promise<OfacCheckResult[]> {
  const sdn = await getSdnList();

  return vendorNames.map((vendor) => {
    const result = screenVendor(vendor, sdn);
    return {
      vendor,
      hit: result !== null,
      matched_name: result?.name,
      list_type: result?.list_type,
    };
  });
}

// ── SDN list fetching and parsing ─────────────────────────────────

async function getSdnList(): Promise<SdnEntry[]> {
  if (sdnCache !== null) return sdnCache;

  try {
    const response = await fetch(OFAC_CONSOLIDATED, {
      headers: { 'User-Agent': 'ForensiQ-Portfolio-Tool forensiq@example.com' },
    });

    if (!response.ok) {
      console.error(`OFAC fetch failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    sdnCache = parseOfacXml(xml);
    return sdnCache;
  } catch (err) {
    console.error('OFAC list fetch error:', err);
    return [];
  }
}

/**
 * Minimal XML parser for OFAC SDN consolidated list.
 * Extracts <sdnEntry> blocks with <lastName> (primary name) and
 * <aka> (aliases).
 */
function parseOfacXml(xml: string): SdnEntry[] {
  const entries: SdnEntry[] = [];

  // Match SDN entry blocks
  const entryPattern = /<sdnEntry>([\s\S]*?)<\/sdnEntry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(xml)) !== null) {
    const block = match[1] ?? '';

    const lastName = extractXmlField(block, 'lastName');
    const firstName = extractXmlField(block, 'firstName');
    const sdnType = extractXmlField(block, 'sdnType');

    if (!lastName) continue;

    const primaryName = firstName ? `${firstName} ${lastName}` : lastName;

    // Extract aliases
    const aliasPattern = /<aka>([\s\S]*?)<\/aka>/gi;
    const aliases: string[] = [];
    let aliasMatch: RegExpExecArray | null;

    while ((aliasMatch = aliasPattern.exec(block)) !== null) {
      const aliasBlock = aliasMatch[1] ?? '';
      const aliasLast = extractXmlField(aliasBlock, 'lastName');
      const aliasFirst = extractXmlField(aliasBlock, 'firstName');
      if (aliasLast) {
        aliases.push(aliasFirst ? `${aliasFirst} ${aliasLast}` : aliasLast);
      }
    }

    entries.push({
      name: primaryName,
      list_type: sdnType ?? 'SDN',
      aliases,
    });
  }

  return entries;
}

function extractXmlField(xml: string, field: string): string | null {
  const pattern = new RegExp(`<${field}>(.*?)<\\/${field}>`, 'i');
  const match = pattern.exec(xml);
  return match?.[1]?.trim() ?? null;
}

// ── Vendor screening ──────────────────────────────────────────────

function screenVendor(vendor: string, sdn: SdnEntry[]): SdnEntry | null {
  const vendorLower = vendor.toLowerCase().trim();

  for (const entry of sdn) {
    const allNames = [entry.name, ...entry.aliases];

    for (const name of allNames) {
      const nameLower = name.toLowerCase().trim();

      // Exact match (normalized)
      if (vendorLower === nameLower) return entry;

      // Fuzzy match — Levenshtein distance ≤ 2 on name tokens
      if (fuzzyNameMatch(vendorLower, nameLower)) return entry;
    }
  }

  return null;
}

function fuzzyNameMatch(a: string, b: string): boolean {
  // Only apply fuzzy matching to names of similar length (±30%)
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.3) {
    return false;
  }

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);

  // Distance ≤ 2 for short names; ≤ 5% of length for longer names
  return dist <= Math.max(2, Math.floor(maxLen * 0.05));
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? (dp[i - 1]?.[j - 1] ?? 0)
          : 1 + Math.min(
              dp[i - 1]?.[j] ?? 0,
              dp[i]?.[j - 1] ?? 0,
              dp[i - 1]?.[j - 1] ?? 0
            );
    }
  }

  return dp[m]?.[n] ?? 0;
}
