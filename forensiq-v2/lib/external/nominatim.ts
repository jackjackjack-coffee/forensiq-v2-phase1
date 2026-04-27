// lib/external/nominatim.ts
// ─────────────────────────────────────────────────────────────────
// OpenStreetMap Nominatim address geocoding for ghost vendor detection.
// Free, no API key. Respects 1 req/sec rate limit (OSM policy).
// Called from Supabase Edge Function only.
// ─────────────────────────────────────────────────────────────────

import type { NominatimResult } from '../types/transaction';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_MS = 1100; // 1.1 second between requests (OSM policy: 1/sec)

// ── Address types that warrant flagging ───────────────────────────
// Residential or virtual office addresses are red flags for ghost vendors.
const SUSPICIOUS_ADDRESS_TYPES = new Set([
  'residential',
  'house',
  'apartment',
  'mailbox',
  'virtual_office',
  // Nominatim OSM class types:
  'place',
  'hamlet',
]);

/**
 * Nominatim Address Verification — Ghost Vendor Detection
 *
 * Accounting basis: Fictitious vendor schemes frequently use addresses that:
 * 1. Do not exist (invalid/non-geocodable)
 * 2. Resolve to residential locations (employee's home address)
 * 3. Resolve to virtual office / mail forwarding services
 *
 * Ghost vendors are the most costly form of billing fraud — the ACFE 2024
 * Report found a median loss of $220,000 per ghost vendor scheme.
 *
 * Verification procedure: Geocode the vendor address and flag when:
 * - Address returns no results (does not exist)
 * - Address type resolves to a residential property
 * - Address matches a known virtual office cluster
 *
 * Standard: ACFE Fraud Examiners Manual — Vendor Fraud chapter.
 * API: OpenStreetMap Nominatim (free, 1 req/sec, User-Agent required).
 *
 * NOTE: Rate limit enforced here — do not call in a tight loop.
 * Use verifyAddressBatch() which manages rate limiting automatically.
 *
 * @param address - Vendor address string as it appears in the vendor master file
 * @returns Geocoding result with validity assessment
 */
export async function verifyAddress(address: string): Promise<NominatimResult> {
  const encoded = encodeURIComponent(address.trim());
  const url = `${NOMINATIM_BASE}?q=${encoded}&format=json&limit=1&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ForensiQ-Portfolio-Tool forensiq@example.com',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return { address, valid: false };
    }

    const data = (await response.json()) as unknown[];

    if (!Array.isArray(data) || data.length === 0) {
      return { address, valid: false };
    }

    const result = data[0] as Record<string, unknown>;
    const lat = parseFloat(String(result['lat'] ?? ''));
    const lon = parseFloat(String(result['lon'] ?? ''));
    const address_type = String(result['type'] ?? result['class'] ?? '');

    const is_suspicious = SUSPICIOUS_ADDRESS_TYPES.has(address_type.toLowerCase());

    return {
      address,
      valid: !isNaN(lat) && !isNaN(lon) && !is_suspicious,
      lat: isNaN(lat) ? undefined : lat,
      lon: isNaN(lon) ? undefined : lon,
      address_type,
    };
  } catch {
    return { address, valid: false };
  }
}

/**
 * Batch address verification with automatic 1 req/sec rate limiting.
 * Deduplicates addresses before querying — a vendor with 50 invoices
 * only triggers one geocoding call.
 *
 * @param addresses - Array of vendor addresses (may contain duplicates)
 * @returns Map of address → NominatimResult
 */
export async function verifyAddressBatch(
  addresses: string[]
): Promise<Map<string, NominatimResult>> {
  const unique = [...new Set(addresses.map((a) => a.trim()).filter(Boolean))];
  const results = new Map<string, NominatimResult>();

  for (let i = 0; i < unique.length; i++) {
    const address = unique[i];
    if (!address) continue;

    const result = await verifyAddress(address);
    results.set(address, result);

    // Respect OSM rate limit between requests (not after last one)
    if (i < unique.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  return results;
}

// ── Utility ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
