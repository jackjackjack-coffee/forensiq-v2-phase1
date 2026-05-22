// app/api/external-verify/route.ts
// ─────────────────────────────────────────────────────────────────
// Server-side proxy for EDGAR, OFAC, and Nominatim API calls.
// Must run server-side: EDGAR has CORS restrictions, Nominatim
// requires 1 req/sec rate limiting and a User-Agent header, and
// OFAC requires fetching the SDN XML feed which is multi-MB.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { checkEdgar } from '@/lib/external/edgar';
import { checkOfacBatch } from '@/lib/external/ofac';
import { verifyAddressBatch } from '@/lib/external/nominatim';

// Allow up to 30s on Vercel Pro (Hobby caps at 10s automatically).
// Nominatim is 1 req/sec, so address verification is the bottleneck.
export const maxDuration = 30;

// Hard caps so a giant ledger can't blow the route's wall-clock budget.
// Vendor verification fans out concurrently; address verification is serial.
const MAX_VENDORS_VERIFIED = 50;
const MAX_ADDRESSES_VERIFIED = 8;

export interface ExternalVerifyRequest {
  vendors: string[];
  addresses: string[];
}

export interface ExternalVerifyResponse {
  edgar: Record<string, { matched: boolean; confidence: number }>;
  ofac: Record<string, { hit: boolean; matched_name?: string; list_type?: string }>;
  nominatim: Record<string, { valid: boolean }>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ExternalVerifyRequest;
  try {
    body = (await req.json()) as ExternalVerifyRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allVendors: string[] = Array.isArray(body.vendors) ? body.vendors : [];
  const allAddresses: string[] = Array.isArray(body.addresses) ? body.addresses : [];
  const vendors = allVendors.slice(0, MAX_VENDORS_VERIFIED);
  const addresses = allAddresses.slice(0, MAX_ADDRESSES_VERIFIED);

  // ── EDGAR (SEC) ────────────────────────────────────────────────
  // Concurrent — SEC API has no stated rate limit for reasonable use.
  const edgarEntries = await Promise.all(
    vendors.map(async (vendor) => {
      const result = await checkEdgar(vendor);
      return [vendor, { matched: result.matched, confidence: result.confidence }] as const;
    })
  );
  const edgar = Object.fromEntries(edgarEntries);

  // ── OFAC SDN sanctions screening ───────────────────────────────
  // Single batch — the SDN list is fetched once and held in module cache.
  const ofac: Record<string, { hit: boolean; matched_name?: string; list_type?: string }> = {};
  if (vendors.length > 0) {
    try {
      const ofacResults = await checkOfacBatch(vendors);
      for (const r of ofacResults) {
        ofac[r.vendor] = {
          hit: r.hit,
          ...(r.matched_name ? { matched_name: r.matched_name } : {}),
          ...(r.list_type ? { list_type: r.list_type } : {}),
        };
      }
    } catch {
      // OFAC unreachable — leave map empty; downstream treats missing as null.
    }
  }

  // ── Nominatim address geocoding ─────────────────────────────────
  // Built-in 1 req/sec rate limiting; skip if no addresses.
  const nominatim: Record<string, { valid: boolean }> = {};
  if (addresses.length > 0) {
    const nominatimResults = await verifyAddressBatch(addresses);
    nominatimResults.forEach((result, address) => {
      nominatim[address] = { valid: result.valid };
    });
  }

  return NextResponse.json({ edgar, ofac, nominatim } satisfies ExternalVerifyResponse);
}
