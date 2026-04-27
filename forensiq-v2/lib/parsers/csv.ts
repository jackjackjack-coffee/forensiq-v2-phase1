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

  // Validate required column mapping targets exist in headers
  const requiredFields: Array<keyof ColumnMapping> = ['amount', 'date', 'vendor'];
  for (const field of requiredFields) {
    const col = mapping[field]?.toLowerCase();
    if (!col || !headers.includes(col)) {
      errors.push({
        row: 0,
        field,
        message: `Mapped column "${mapping[field]}" not found in CSV headers. Available: ${headers.join(', ')}`,
      });
    }
  }
  if (errors.length > 0) {
    return { transactions: [], errors, skipped_rows: 0 };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed for auditor-facing messages
    const values = parseCsvLine(lines[i]);

    if (values.length !== headers.length) {
      errors.push({ row: rowNum, field: '*', message: 'Column count mismatch — row skipped' });
      skipped_rows++;
      continue;
    }

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

  // Date — required, must be parseable
  const rawDate = String(row[mapping.date.toLowerCase()] ?? '').trim();
  if (!isValidDateString(rawDate)) {
    errors.push({ row: rowNum, field: 'date', message: `Invalid date format: "${rawDate}"` });
    return null;
  }

  // Vendor — required
  const vendor = String(row[mapping.vendor.toLowerCase()] ?? '').trim();
  if (!vendor) {
    errors.push({ row: rowNum, field: 'vendor', message: 'Empty vendor name' });
    return null;
  }

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
    date: normalizeDate(rawDate),
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
