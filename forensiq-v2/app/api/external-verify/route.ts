// app/api/external-verify/route.ts
// ─────────────────────────────────────────────────────────────────
// Server-side proxy for EDGAR and Nominatim API calls.
// Must run server-side: EDGAR has CORS restrictions, Nominatim
// requires 1 req/sec rate limiting and a User-Agent header.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { checkEdgar } from '@/lib/external/edgar';
import { verifyAddressBatch } from '@/lib/external/nominatim';

export interface ExternalVerifyRequest {
  vendors: string[];
  addresses: string[];
}

export interface ExternalVerifyResponse {
  edgar: Record<string, { matched: boolean; confidence: number }>;
  nominatim: Record<string, { valid: boolean }>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ExternalVerifyRequest;
  try {
    body = (await req.json()) as ExternalVerifyRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const vendors: string[] = Array.isArray(body.vendors) ? body.vendors : [];
  const addresses: string[] = Array.isArray(body.addresses) ? body.addresses : [];

  // Run EDGAR checks concurrently (SEC API has no stated rate limit for reasonable use)
  const edgarEntries = await Promise.all(
    vendors.map(async (vendor) => {
      const result = await checkEdgar(vendor);
      return [vendor, { matched: result.matched, confidence: result.confidence }] as const;
    })
  );
  const edgar = Object.fromEntries(edgarEntries);

  // Run Nominatim batch with built-in 1 req/sec rate limiting.
  // Skip entirely if no addresses were provided.
  const nominatim: Record<string, { valid: boolean }> = {};
  if (addresses.length > 0) {
    const nominatimResults = await verifyAddressBatch(addresses);
    nominatimResults.forEach((result, address) => {
      nominatim[address] = { valid: result.valid };
    });
  }

  return NextResponse.json({ edgar, nominatim } satisfies ExternalVerifyResponse);
}
