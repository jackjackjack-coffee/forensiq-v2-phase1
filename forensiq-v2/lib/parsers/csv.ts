// lib/parsers/csv.ts
// ─────────────────────────────────────────────────────────────────
// Client-side CSV parsing using PapaParse.
// All parsing happens in-browser — no data leaves the auditor's machine.
// ─────────────────────────────────────────────────────────────────

import type {
  RawTransaction,
  ColumnMapping,
  ParseResult,
  ParseError,
} from '../types/transaction';

// ── PapaParse row shape (unknown until parsed) ───────────────────
type CsvRow = Record<string, unknown>;

/**
 * Parse a CSV file into RawTransaction records using a column mapping.
 *
 * Accounting basis: Invoice ledgers use non-standard column names across
 * ERP systems (SAP uses DMBTR, Oracle uses ENTERED_DR). Column mapping
 * lets the auditor normalize any export format.
 *
 * Standard: AICPA AU-C 240 — auditor responsibility for obtaining
 * and organizing data from client accounting systems.
 *
 * @param csvText   - Raw CSV file content as a string
 * @param mapping   - Maps canonical field names to actual CSV column headers
 * @returns ParseResult with cleaned transactions and any row-level errors
 */
export function parseCsv(csvText: string, inputMapping: ColumnMapping): ParseResult {
  let mapping: ColumnMapping = { ...inputMapping };
  const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { transactions: [], errors: [], skipped_rows: 0 };
  }

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];
  let skipped_rows = 0;
  let credit_rows = 0;

  // Find amount column — try mapped name first, then fall back to first numeric column
  let amountCol = mapping['amount']?.toLowerCase();
  if (!amountCol || !headers.includes(amountCol)) {
    amountCol = detectNumericColumn(lines, headers) ?? headers[0] ?? '';
    if (amountCol) mapping = { ...mapping, amount: amountCol };
  }
  if (!amountCol) {
    errors.push({ row: 0, field: 'amount', message: 'No columns found in CSV.' });
    return { transactions: [], errors, skipped_rows: 0 };
  }

  // Detect the date format up-front from a sample of rows so we can
  // disambiguate MM/DD vs DD/MM rather than silently shifting dates.
  const dateCol = mapping.date?.toLowerCase();
  const dateFormat: NonNullable<ParseResult['date_format']> = dateCol && headers.includes(dateCol)
    ? detectDateFormat(lines, headers, dateCol)
    : 'unknown';

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed for auditor-facing messages
    const values = parseCsvLine(lines[i]);

    while (values.length < headers.length) values.push('');

    const row: CsvRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx]; });

    const outcome = extractTransaction(row, mapping, rowNum, errors, dateFormat);
    if (outcome.kind === 'ok') {
      transactions.push(outcome.txn);
    } else if (outcome.kind === 'credit') {
      credit_rows++;
    } else {
      skipped_rows++;
    }
  }

  return {
    transactions,
    errors,
    skipped_rows,
    resolved_mapping: mapping,
    credit_rows,
    date_format: dateFormat,
  };
}

// ── Internal helpers ─────────────────────────────────────────────

type ExtractOutcome =
  | { kind: 'ok'; txn: RawTransaction }
  | { kind: 'credit' }   // amount was 0 or negative — a refund/credit, counted separately
  | { kind: 'skip' };    // unparseable amount

function extractTransaction(
  row: CsvRow,
  mapping: ColumnMapping,
  rowNum: number,
  errors: ParseError[],
  dateFormat: NonNullable<ParseResult['date_format']>,
): ExtractOutcome {
  // Amount — required, must be numeric. Zero or negative = credit/refund.
  const rawAmount = row[mapping.amount.toLowerCase()];
  const amount = parseFloat(String(rawAmount ?? '').replace(/[$,\s]/g, ''));
  if (isNaN(amount)) {
    errors.push({ row: rowNum, field: 'amount', message: `Unparseable amount: "${rawAmount}"` });
    return { kind: 'skip' };
  }
  if (amount <= 0) {
    return { kind: 'credit' };
  }

  // Date — optional, falls back to today
  const dateCol = mapping.date?.toLowerCase();
  const rawDate = dateCol && headers_available(row, dateCol) ? String(row[dateCol] ?? '').trim() : '';
  const date = isValidDateString(rawDate, dateFormat)
    ? normalizeDate(rawDate, dateFormat)
    : new Date().toISOString().split('T')[0]!;

  // Vendor — optional, falls back to "Unknown"
  const vendorCol = mapping.vendor?.toLowerCase();
  const vendor = (vendorCol && headers_available(row, vendorCol) ? String(row[vendorCol] ?? '').trim() : '') || 'Unknown';

  // invoice_id — optional, auto-generate if missing
  const invoiceIdCol = mapping.invoice_id?.toLowerCase();
  const invoice_id = invoiceIdCol && row[invoiceIdCol]
    ? String(row[invoiceIdCol]).trim()
    : `ROW-${rowNum}`;

  // Optional fields
  const descriptionCol = mapping.description?.toLowerCase();
  const categoryCol = mapping.category?.toLowerCase();
  const approvedByCol = mapping.approved_by?.toLowerCase();

  const addressCol = mapping.address?.toLowerCase();

  return {
    kind: 'ok',
    txn: {
      invoice_id,
      date,
      vendor,
      amount,
      description: descriptionCol ? String(row[descriptionCol] ?? '').trim() || undefined : undefined,
      category: categoryCol ? String(row[categoryCol] ?? '').trim() || undefined : undefined,
      approved_by: approvedByCol ? String(row[approvedByCol] ?? '').trim() || undefined : undefined,
      address: addressCol ? String(row[addressCol] ?? '').trim() || undefined : undefined,
    },
  };
}

/**
 * Minimal RFC 4180-compliant CSV line parser.
 * Handles quoted fields with embedded commas and escaped quotes.
 */
function headers_available(row: CsvRow, col: string): boolean {
  return col in row;
}

/**
 * Find the column most likely to contain monetary amounts by sampling rows
 * and counting which column has the highest ratio of positive numeric values.
 */
function detectNumericColumn(lines: string[], headers: string[]): string | undefined {
  const sampleSize = Math.min(20, lines.length - 1);
  const scores = new Map<string, number>();

  for (let i = 1; i <= sampleSize; i++) {
    const values = parseCsvLine(lines[i] ?? '');
    headers.forEach((h, idx) => {
      const raw = String(values[idx] ?? '').replace(/[$,\s]/g, '');
      const n = parseFloat(raw);
      if (!isNaN(n) && n > 0 && raw !== '') {
        scores.set(h, (scores.get(h) ?? 0) + 1);
      }
    });
  }

  let best: string | undefined;
  let bestScore = 0;
  scores.forEach((score, col) => {
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  });
  return bestScore >= sampleSize * 0.5 ? best : undefined;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Detect whether a date column is ISO (YYYY-MM-DD), US (MM/DD/YYYY), or EU
 * (DD/MM/YYYY) format by sampling rows. Returns 'ambiguous' when the sample
 * doesn't distinguish US vs EU (e.g., every row has both parts ≤ 12).
 *
 * Without this, `new Date('01/02/2024')` is treated as US format by the JS
 * runtime, silently shifting European DD/MM/YYYY dates by a month.
 */
function detectDateFormat(
  lines: string[],
  headers: string[],
  dateCol: string,
): NonNullable<ParseResult['date_format']> {
  const colIdx = headers.indexOf(dateCol);
  if (colIdx < 0) return 'unknown';

  const sampleSize = Math.min(50, lines.length - 1);
  let iso = 0, slashFirstOver12 = 0, slashSecondOver12 = 0, slashSeen = 0;

  for (let i = 1; i <= sampleSize; i++) {
    const v = String(parseCsvLine(lines[i] ?? '')[colIdx] ?? '').trim();
    if (!v) continue;
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) { iso++; continue; }
    const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      slashSeen++;
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a > 12) slashFirstOver12++;
      if (b > 12) slashSecondOver12++;
    }
  }

  if (iso > slashSeen) return 'ISO';
  if (slashSeen === 0) return 'unknown';
  if (slashFirstOver12 > 0 && slashSecondOver12 === 0) return 'EU (DD/MM)';
  if (slashSecondOver12 > 0 && slashFirstOver12 === 0) return 'US (MM/DD)';
  // Tied or both kinds present — too ambiguous; default to ISO interpretation downstream.
  return 'ambiguous';
}

function isValidDateString(date: string, _format: NonNullable<ParseResult['date_format']>): boolean {
  if (!date) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

function normalizeDate(date: string, format: NonNullable<ParseResult['date_format']>): string {
  // ISO date passes through unchanged.
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(date)) {
    const parsed = new Date(date);
    return parsed.toISOString().split('T')[0]!;
  }
  // Slash/dash dates: reinterpret based on detected format to avoid the
  // silent US-default that `new Date()` applies.
  const m = date.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m && (format === 'EU (DD/MM)' || format === 'US (MM/DD)')) {
    const d = Number(format === 'EU (DD/MM)' ? m[1] : m[2]);
    const mo = Number(format === 'EU (DD/MM)' ? m[2] : m[1]);
    let y = Number(m[3]);
    if (y < 100) y += y < 70 ? 2000 : 1900;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0]!;
  }
  const parsed = new Date(date);
  return parsed.toISOString().split('T')[0]!;
}

// ── Default column mapping (matches sample-invoices.csv) ─────────
export const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  amount: 'amount',
  date: 'date',
  vendor: 'vendor',
  invoice_id: 'invoice_id',
  description: 'description',
  category: 'category',
  approved_by: 'approved_by',
};

/**
 * Auto-detect column mapping from CSV headers using common ERP field names.
 * Falls back to DEFAULT_COLUMN_MAPPING for any unrecognized headers.
 */
export function autoDetectMapping(csvText: string): ColumnMapping {
  const firstLine = csvText.split('\n')[0] ?? '';
  const headers = parseCsvLine(firstLine).map((h) => h.trim().toLowerCase());

  const amountAliases = ['amount', 'amt', 'total', 'dmbtr', 'entered_dr', 'invoice_amount', 'value'];
  const dateAliases = ['date', 'invoice_date', 'posting_date', 'budat', 'trans_date', 'transaction_date'];
  const vendorAliases = ['vendor', 'vendor_name', 'supplier', 'payee', 'lifnr', 'company'];
  const invoiceAliases = ['invoice_id', 'invoice_number', 'inv_num', 'reference', 'doc_number', 'belnr'];
  const descAliases = ['description', 'desc', 'memo', 'notes', 'sgtxt', 'text'];
  const addressAliases = ['address', 'vendor_address', 'supplier_address', 'street_address', 'addr', 'location'];

  return {
    amount: findFirst(headers, amountAliases) ?? DEFAULT_COLUMN_MAPPING.amount,
    date: findFirst(headers, dateAliases) ?? DEFAULT_COLUMN_MAPPING.date,
    vendor: findFirst(headers, vendorAliases) ?? DEFAULT_COLUMN_MAPPING.vendor,
    invoice_id: findFirst(headers, invoiceAliases) ?? DEFAULT_COLUMN_MAPPING.invoice_id,
    description: findFirst(headers, descAliases) ?? DEFAULT_COLUMN_MAPPING.description,
    address: findFirst(headers, addressAliases),
  };
}

function findFirst(headers: string[], aliases: string[]): string | undefined {
  for (const alias of aliases) {
    if (headers.includes(alias)) return alias;
  }
  return undefined;
}
