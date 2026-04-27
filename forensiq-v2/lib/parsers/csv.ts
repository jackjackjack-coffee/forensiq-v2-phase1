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
export function parseCsv(csvText: string, mapping: ColumnMapping): ParseResult {
  const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { transactions: [], errors: [], skipped_rows: 0 };
  }

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const errors: ParseError[] = [];
  const transactions: RawTransaction[] = [];
  let skipped_rows = 0;

  // Only amount is truly required — date and vendor fall back to defaults
  const amountCol = mapping['amount']?.toLowerCase();
  if (!amountCol || !headers.includes(amountCol)) {
    errors.push({
      row: 0,
      field: 'amount',
      message: `Could not find an amount column. Available columns: ${headers.join(', ')}`,
    });
    return { transactions: [], errors, skipped_rows: 0 };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed for auditor-facing messages
    const values = parseCsvLine(lines[i]);

    while (values.length < headers.length) values.push('');

    const row: CsvRow = {};
    headers.forEach((h, idx) => { row[h] = values[idx]; });

    const extracted = extractTransaction(row, mapping, rowNum, errors);
    if (extracted !== null) {
      transactions.push(extracted);
    } else {
      skipped_rows++;
    }
  }

  return { transactions, errors, skipped_rows };
}

// ── Internal helpers ─────────────────────────────────────────────

function extractTransaction(
  row: CsvRow,
  mapping: ColumnMapping,
  rowNum: number,
  errors: ParseError[]
): RawTransaction | null {
  // Amount — required, must be positive numeric
  const rawAmount = row[mapping.amount.toLowerCase()];
  const amount = parseFloat(String(rawAmount ?? '').replace(/[$,\s]/g, ''));
  if (isNaN(amount) || amount <= 0) {
    errors.push({ row: rowNum, field: 'amount', message: `Invalid or non-positive amount: "${rawAmount}"` });
    return null;
  }

  // Date — optional, falls back to today
  const dateCol = mapping.date?.toLowerCase();
  const rawDate = dateCol && headers_available(row, dateCol) ? String(row[dateCol] ?? '').trim() : '';
  const date = isValidDateString(rawDate) ? normalizeDate(rawDate) : new Date().toISOString().split('T')[0]!;

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

  return {
    invoice_id,
    date,
    vendor,
    amount,
    description: descriptionCol ? String(row[descriptionCol] ?? '').trim() || undefined : undefined,
    category: categoryCol ? String(row[categoryCol] ?? '').trim() || undefined : undefined,
    approved_by: approvedByCol ? String(row[approvedByCol] ?? '').trim() || undefined : undefined,
  };
}

/**
 * Minimal RFC 4180-compliant CSV line parser.
 * Handles quoted fields with embedded commas and escaped quotes.
 */
function headers_available(row: CsvRow, col: string): boolean {
  return col in row;
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

function isValidDateString(date: string): boolean {
  if (!date) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

function normalizeDate(date: string): string {
  const parsed = new Date(date);
  return parsed.toISOString().split('T')[0]; // YYYY-MM-DD
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

  return {
    amount: findFirst(headers, amountAliases) ?? DEFAULT_COLUMN_MAPPING.amount,
    date: findFirst(headers, dateAliases) ?? DEFAULT_COLUMN_MAPPING.date,
    vendor: findFirst(headers, vendorAliases) ?? DEFAULT_COLUMN_MAPPING.vendor,
    invoice_id: findFirst(headers, invoiceAliases) ?? DEFAULT_COLUMN_MAPPING.invoice_id,
    description: findFirst(headers, descAliases) ?? DEFAULT_COLUMN_MAPPING.description,
  };
}

function findFirst(headers: string[], aliases: string[]): string | undefined {
  for (const alias of aliases) {
    if (headers.includes(alias)) return alias;
  }
  return undefined;
}
