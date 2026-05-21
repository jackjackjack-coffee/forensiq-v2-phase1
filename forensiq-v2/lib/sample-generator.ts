// Generates a randomised sample CSV in-browser. Every call produces a
// different dataset — both transaction count (500–10,000) and the
// specific vendors / amounts / dates vary. Vendors are drawn from a
// list of real, well-known global companies.

type VendorRow = [name: string, category: string, typMin: number, typMax: number];

// ── Real companies (~80), grouped by typical category ─────────────────
const REAL_VENDORS: VendorRow[] = [
  // IT / SaaS / Cloud
  ['Microsoft Corporation',     'IT',          5000, 250000],
  ['Oracle Corporation',        'IT',          8000, 200000],
  ['Salesforce Inc',            'IT',          3000, 150000],
  ['Adobe Systems',             'IT',          1000,  80000],
  ['ServiceNow',                'IT',          2000, 120000],
  ['Atlassian',                 'IT',           500,  40000],
  ['Snowflake',                 'IT',          5000, 180000],
  ['Datadog',                   'IT',          1000,  60000],
  ['MongoDB',                   'IT',           500,  35000],
  ['GitHub',                    'IT',           200,  25000],
  ['GitLab',                    'IT',           300,  20000],
  ['Amazon Web Services',       'IT',          2000, 300000],
  ['Google Cloud',              'IT',          2000, 200000],
  ['Cisco Systems',             'IT',          3000, 150000],
  ['IBM',                       'IT',          5000, 200000],
  ['SAP',                       'IT',          6000, 220000],
  ['Workday',                   'IT',          3000, 150000],
  ['Zoom Communications',       'IT',           300,  40000],
  ['Slack Technologies',        'IT',           200,  25000],
  ['Dropbox',                   'IT',           150,  18000],
  // Consulting
  ['Deloitte',                  'CONSULTING', 10000, 500000],
  ['PricewaterhouseCoopers',    'CONSULTING', 10000, 450000],
  ['Ernst & Young',             'CONSULTING',  8000, 400000],
  ['KPMG',                      'CONSULTING',  8000, 400000],
  ['McKinsey & Company',        'CONSULTING', 15000, 600000],
  ['Boston Consulting Group',   'CONSULTING', 12000, 550000],
  ['Bain & Company',            'CONSULTING', 12000, 500000],
  ['Accenture',                 'CONSULTING',  5000, 300000],
  ['Capgemini',                 'CONSULTING',  4000, 250000],
  ['Infosys',                   'CONSULTING',  3000, 200000],
  ['Tata Consultancy Services', 'CONSULTING',  3000, 220000],
  ['Cognizant',                 'CONSULTING',  3000, 180000],
  // Legal
  ['Latham & Watkins',          'LEGAL',       5000, 300000],
  ['Skadden Arps',              'LEGAL',       6000, 350000],
  ['Kirkland & Ellis',          'LEGAL',       5000, 300000],
  ['Baker McKenzie',            'LEGAL',       3000, 200000],
  ['DLA Piper',                 'LEGAL',       3000, 180000],
  ['Jones Day',                 'LEGAL',       4000, 220000],
  ['Sidley Austin',             'LEGAL',       4000, 200000],
  ['White & Case',              'LEGAL',       3500, 190000],
  // Finance / Banking
  ['Goldman Sachs',             'FINANCE',    10000, 500000],
  ['JPMorgan Chase',            'FINANCE',     8000, 400000],
  ['Morgan Stanley',            'FINANCE',     8000, 400000],
  ['BlackRock',                 'FINANCE',     6000, 350000],
  ['Citigroup',                 'FINANCE',     5000, 300000],
  ['Bank of America',           'FINANCE',     5000, 280000],
  ['Wells Fargo',               'FINANCE',     4000, 240000],
  // Logistics
  ['FedEx Corporation',         'LOGISTICS',    200,  30000],
  ['United Parcel Service',     'LOGISTICS',    200,  30000],
  ['DHL Express',               'LOGISTICS',    300,  35000],
  ['Maersk Line',               'LOGISTICS',   2000, 120000],
  ['C.H. Robinson',             'LOGISTICS',   1000,  60000],
  ['XPO Logistics',             'LOGISTICS',    800,  50000],
  ['Expeditors International',  'LOGISTICS',   1500,  80000],
  // Marketing / Advertising
  ['WPP Group',                 'MARKETING',   3000, 200000],
  ['Omnicom Group',             'MARKETING',   3000, 180000],
  ['Publicis Groupe',           'MARKETING',   2500, 150000],
  ['Interpublic Group',         'MARKETING',   2500, 140000],
  ['Dentsu',                    'MARKETING',   2000, 120000],
  // Security
  ['Palo Alto Networks',        'SECURITY',    2000, 120000],
  ['CrowdStrike',               'SECURITY',    1500, 100000],
  ['Fortinet',                  'SECURITY',    1000,  80000],
  ['Splunk',                    'SECURITY',    2000, 100000],
  ['Check Point Software',      'SECURITY',    1500,  90000],
  ['SentinelOne',               'SECURITY',    1000,  70000],
  ['Rapid7',                    'SECURITY',     800,  60000],
  // Facilities / Office
  ['WeWork',                    'FACILITIES',   500,  50000],
  ['Regus',                     'FACILITIES',   400,  35000],
  ['Steelcase',                 'FACILITIES',   500,  30000],
  ['Herman Miller',             'FACILITIES',   500,  35000],
  ['Staples',                   'SUPPLIES',      50,   5000],
  ['Office Depot',              'SUPPLIES',      50,   5000],
  // Operations / Equipment / Industrial
  ['Honeywell',                 'OPERATIONS',  2000, 150000],
  ['Caterpillar',               'OPERATIONS',  5000, 200000],
  ['3M Company',                'OPERATIONS',   500,  40000],
  ['General Electric',          'OPERATIONS',  5000, 250000],
  ['Siemens',                   'OPERATIONS',  5000, 200000],
  ['Schneider Electric',        'OPERATIONS',  3000, 150000],
  ['Emerson Electric',          'OPERATIONS',  2000, 120000],
];

// Fuzzy variants — real company name vs subtle misspelling/variation
const REAL_FUZZY_VARIANTS: Record<string, string> = {
  'Microsoft Corporation':     'Microsft Corporation',         // typo
  'Amazon Web Services':       'Amazon Web Service',           // missing s
  'Goldman Sachs':             'Goldman Sach',                 // missing s
  'Deloitte':                  'Deloite',                      // missing t
  'Oracle Corporation':        'Oracle Corp',                  // abbrev
  'Salesforce Inc':            'Salesforce Incorporated',      // full form
  'Palo Alto Networks':        'Palo Alto Network',            // missing s
  'JPMorgan Chase':            'JP Morgan Chase',              // space added
  'Ernst & Young':             'Ernst and Young',              // & vs and
  'McKinsey & Company':        'Mckinsey & Company',           // capitalization
};

const LEGIT_DESCS = [
  'Monthly software license renewal',
  'Q1 consulting services — enterprise architecture',
  'Network infrastructure upgrade phase 2',
  'Legal retainer — contract review and advisory',
  'Office supplies and stationery restock',
  'Digital marketing campaign execution',
  'Annual security audit and penetration testing',
  'Cloud hosting — production environment monthly',
  'Staff compliance certification training',
  'Facilities management — HVAC preventive maintenance',
  'Equipment lease payment',
  'Freight and logistics — bulk shipment handling',
  'Industry conference attendance — professional development',
  'Tax planning and financial advisory services',
  'Catering services — quarterly board meeting',
  'HR consulting — executive recruitment cycle',
  'Data analytics platform subscription renewal',
  'Print and marketing collateral production',
  'IT helpdesk and L2 support services',
  'Structural engineering assessment',
  'Software development sprint — backend API',
  'Legal filing fees and court documentation costs',
  'Annual maintenance and support contract renewal',
  'Temporary staffing — operations peak period',
  'Market research and competitive landscape analysis',
  'Cybersecurity monitoring — 24/7 SOC retainer',
  'Financial audit preparation support',
  'Employee benefits consulting — open enrollment',
  'Warehouse storage and fulfillment services',
  'Brand identity redesign — new product line',
  'Database migration and cloud uplift services',
  'Security camera installation — warehouse expansion',
  'Executive coaching program — leadership team',
  'Payroll processing services — monthly retainer',
  'Insurance premium — commercial liability policy',
  'Inventory management system — annual license',
  'Third-party pen test — web application scope',
  'Copier and printer lease — main office',
  'Translation and localization services',
  'ERP system customization — procurement module',
];

const SUSP_DESCS = [
  'Miscellaneous expenses',
  'Misc',
  'Various services',
  'Gift cards — client appreciation',
  'Cash advance — project expenses',
  'Personal expense reimbursement',
  'Adjustment',
  'Correction — prior period',
  'See attached documentation',
  'Per prior agreement',
  'Services rendered',
  'General expenses',
  'Consulting — no further details',
  'Emergency procurement',
  '',
];

const APPROVERS = ['J.Harrison', 'M.Chen', 'S.Patel', 'R.Novak', 'L.Torres', 'D.Okafor', 'A.Reeves'];

// Seeded LCG so the seed (set per call) determines the dataset
function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randInt(rng: () => number, lo: number, hi: number) {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function randAmount(rng: () => number, lo: number, hi: number): number {
  const t = Math.pow(rng(), 2.5);  // skew toward lower amounts (realistic)
  return Math.round((lo + t * (hi - lo)) * 100) / 100;
}

function randDate(rng: () => number): string {
  const year = 2024;
  const dayOfYear = randInt(rng, 2, 361);
  const d = new Date(year, 0, dayOfYear);
  return d.toISOString().split('T')[0]!;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function weightedPick<T>(rng: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

interface Row {
  invoice_id: string;
  date: string;
  vendor: string;
  amount: number;
  description: string;
  category: string;
  approved_by: string;
}

export function generateSampleCsv(): string {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const rng  = makeRng(seed);

  // Total target between 500 and 10,000 — fully randomised every call
  const totalTarget = randInt(rng, 500, 10000);
  const normalCount = Math.max(400, Math.floor(totalTarget * 0.8));
  const fraudScale  = totalTarget / 1000;

  const dupGroups        = Math.max(5,  Math.round(10 * fraudScale));
  const fuzzyPairs       = Math.max(3,  Math.round(5  * fraudScale));
  const splitClusters    = Math.max(3,  Math.round(6  * fraudScale));
  const rsfCount         = Math.max(3,  Math.round(6  * fraudScale));
  const roundCount       = Math.max(10, Math.round(25 * fraudScale));
  const nearThreshCount  = Math.max(10, Math.round(18 * fraudScale));
  const benfordClusterCt = Math.max(15, Math.round(22 * fraudScale));
  const ghostRowsPerVend = Math.max(2,  Math.round(3  * fraudScale));

  let invCounter = 1000 + randInt(rng, 0, 200);
  const nextInv = () => `INV-${++invCounter}`;

  const rows: Row[] = [];

  // Weight first few vendors more heavily so they appear as "regulars"
  const vendorWeights = REAL_VENDORS.map((_, i) => Math.max(1, 10 - Math.floor(i / 4)));

  // ── Normal transactions ────────────────────────────────────────
  for (let i = 0; i < normalCount; i++) {
    const [vname, vcat, vlo, vhi] = weightedPick(rng, REAL_VENDORS, vendorWeights);
    const suspicious = rng() < 0.08;
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      vname,
      amount:      randAmount(rng, vlo, vhi),
      description: suspicious ? pick(rng, SUSP_DESCS) : pick(rng, LEGIT_DESCS),
      category:    rng() < 0.85 ? vcat : pick(rng, ['IT','LEGAL','MARKETING','CONSULTING','LOGISTICS','FINANCE','FACILITIES','SECURITY','OPERATIONS','SUPPLIES']),
      approved_by: pick(rng, APPROVERS),
    });
  }

  // ── Fraud 1: Exact Duplicates ──────────────────────────────────
  for (let g = 0; g < dupGroups; g++) {
    const [vname, vcat, vlo, vhi] = weightedPick(rng, REAL_VENDORS.slice(0, 25), vendorWeights.slice(0, 25));
    const amt   = randAmount(rng, vlo, vhi);
    const dt    = randDate(rng);
    const inv   = nextInv();
    const desc  = pick(rng, LEGIT_DESCS);
    const appr  = pick(rng, APPROVERS);
    const count = rng() < 0.3 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      rows.push({ invoice_id: inv, date: dt, vendor: vname, amount: amt, description: desc, category: vcat, approved_by: appr });
    }
  }

  // ── Fraud 2: Fuzzy Vendor Names ────────────────────────────────
  const fuzzyKeys = Object.keys(REAL_FUZZY_VARIANTS);
  for (let f = 0; f < fuzzyPairs; f++) {
    const realName = fuzzyKeys[f % fuzzyKeys.length]!;
    const fakeName = REAL_FUZZY_VARIANTS[realName]!;
    const vendor   = REAL_VENDORS.find(v => v[0] === realName);
    if (!vendor) continue;
    for (let k = 0; k < randInt(rng, 3, 5); k++) {
      rows.push({
        invoice_id:  nextInv(),
        date:        randDate(rng),
        vendor:      fakeName,
        amount:      randAmount(rng, vendor[2], vendor[3]),
        description: pick(rng, LEGIT_DESCS),
        category:    vendor[1],
        approved_by: pick(rng, APPROVERS),
      });
    }
  }

  // ── Fraud 3: Split Invoices ────────────────────────────────────
  const splitScenarios: Array<[name: string, threshold: number, n: number, lo: number, hi: number]> = [
    ['Microsoft Corporation',   10000, 3, 9550, 9920],
    ['Goldman Sachs',           10000, 4, 9700, 9970],
    ['Deloitte',                25000, 3, 24400, 24900],
    ['Accenture',               10000, 3, 9450, 9820],
    ['Honeywell',               50000, 3, 49000, 49750],
    ['JPMorgan Chase',           5000, 4, 4720, 4970],
    ['Cisco Systems',           10000, 2, 9800, 9980],
  ];
  for (let s = 0; s < splitClusters; s++) {
    const [vname, , n, lo, hi] = splitScenarios[s % splitScenarios.length]!;
    const vendor = REAL_VENDORS.find(v => v[0] === vname);
    if (!vendor) continue;
    const baseDate = randDate(rng);
    const invBase  = nextInv();
    for (let k = 0; k < n; k++) {
      const amt = Math.round((lo + rng() * (hi - lo)) * 100) / 100;
      rows.push({
        invoice_id:  `${invBase}-${String(k + 1).padStart(2, '0')}`,
        date:        addDays(baseDate, randInt(rng, 0, 5)),
        vendor:      vname,
        amount:      amt,
        description: `Partial payment ${k + 1}/${n} — project milestone`,
        category:    vendor[1],
        approved_by: pick(rng, APPROVERS),
      });
    }
  }

  // ── Fraud 4: RSF Outliers ──────────────────────────────────────
  const rsfCases: Array<[name: string, lo: number, hi: number]> = [
    ['Staples',         27000, 45000],
    ['Office Depot',    30000, 42000],
    ['Dropbox',         25000, 38000],
    ['GitHub',          22000, 34000],
    ['Slack Technologies', 28000, 40000],
    ['Zoom Communications', 20000, 32000],
    ['Atlassian',       24000, 37000],
  ];
  for (let r = 0; r < rsfCount; r++) {
    const [vname, lo, hi] = rsfCases[r % rsfCases.length]!;
    const vendor = REAL_VENDORS.find(v => v[0] === vname);
    if (!vendor) continue;
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      vname,
      amount:      Math.round((lo + rng() * (hi - lo)) * 100) / 100,
      description: pick(rng, LEGIT_DESCS.slice(20)),
      category:    vendor[1],
      approved_by: pick(rng, APPROVERS),
    });
  }

  // ── Fraud 5: Round Numbers ─────────────────────────────────────
  const roundPool = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
  for (let r = 0; r < roundCount; r++) {
    const [vname, vcat] = pick(rng, REAL_VENDORS.slice(0, 40));
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      vname,
      amount:      pick(rng, roundPool),
      description: rng() < 0.4 ? pick(rng, SUSP_DESCS.slice(0, 5)) : pick(rng, LEGIT_DESCS.slice(0, 20)),
      category:    vcat,
      approved_by: pick(rng, APPROVERS),
    });
  }

  // ── Fraud 6: Near-threshold Amounts ────────────────────────────
  const nearThreshPool: number[] = [];
  for (const t of [1000, 5000, 10000, 25000, 50000, 100000]) {
    for (let d = 1; d <= 20; d += 5) nearThreshPool.push(t - d);
  }
  for (let n = 0; n < nearThreshCount; n++) {
    const [vname, vcat] = pick(rng, REAL_VENDORS.slice(0, 30));
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      vname,
      amount:      pick(rng, nearThreshPool),
      description: pick(rng, LEGIT_DESCS.slice(0, 25)),
      category:    vcat,
      approved_by: pick(rng, APPROVERS),
    });
  }

  // ── Fraud 7: Ghost Vendors (suspicious, generic names) ─────────
  const ghostVendors: Array<[name: string, cat: string, lo: number, hi: number]> = [
    ['JJ Consulting LLC',          'CONSULTING', 8000, 48000],
    ['Quick Pay Services',         'OPERATIONS', 5000, 40000],
    ['General Business Solutions', 'SUPPLIES',   2000, 20000],
    ['Global Services Group',      'CONSULTING', 4000, 35000],
  ];
  for (const [gv, gcat, glo, ghi] of ghostVendors) {
    for (let k = 0; k < ghostRowsPerVend; k++) {
      rows.push({
        invoice_id:  nextInv(),
        date:        randDate(rng),
        vendor:      gv,
        amount:      randAmount(rng, glo, ghi),
        description: pick(rng, SUSP_DESCS.slice(0, 8)),
        category:    gcat,
        approved_by: pick(rng, APPROVERS.slice(0, 3)),
      });
    }
  }

  // ── Fraud 8: Benford Violation Cluster (digit 7-9 concentrated) ─
  const benfordVendor = pick(rng, ['Goldman Sachs', 'JPMorgan Chase', 'Morgan Stanley']);
  for (let b = 0; b < benfordClusterCt; b++) {
    const startDigit = pick(rng, [7, 8, 9]);
    const lo = startDigit * 10000;
    const hi = lo + 9999;
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      benfordVendor,
      amount:      Math.round((lo + rng() * (hi - lo)) * 100) / 100,
      description: pick(rng, LEGIT_DESCS.slice(10, 30)),
      category:    'FINANCE',
      approved_by: pick(rng, APPROVERS.slice(0, 2)),
    });
  }

  // ── Shuffle ────────────────────────────────────────────────────
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }

  // ── Serialize to CSV ───────────────────────────────────────────
  const header = 'invoice_id,date,vendor,amount,description,category,approved_by';
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = rows.map(r =>
    [r.invoice_id, r.date, r.vendor, r.amount, r.description, r.category, r.approved_by]
      .map(escape).join(',')
  );
  return [header, ...lines].join('\n');
}

export function triggerCsvDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSampleCsv(): void {
  triggerCsvDownload(generateSampleCsv(), 'sample-transactions.csv');
}
