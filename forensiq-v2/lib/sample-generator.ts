// Generates a randomised sample CSV in-browser. Every call produces a
// different dataset while still embedding the same fraud pattern types
// so all detectors have something to find.

const VENDORS: Array<[string, string, number, number]> = [
  // [name, category, typMin, typMax]
  ['Apex Technology Solutions',   'IT',          2000,  80000],
  ['Blue Ridge Analytics Group',  'CONSULTING',  5000,  95000],
  ['Meridian Legal Partners LLP', 'LEGAL',       2500,  45000],
  ['Summit Financial Advisors',   'FINANCE',     3000,  70000],
  ['Cascade Digital Systems',     'IT',          1500,  60000],
  ['Frontier Logistics Partners', 'LOGISTICS',    500,  15000],
  ['Northpoint Marketing Agency', 'MARKETING',   1000,  25000],
  ['Ironwood Engineering Corp',   'OPERATIONS',  2000,  40000],
  ['Lakeview Office Supplies Co', 'SUPPLIES',     100,   5000],
  ['Titan Security Services',     'SECURITY',    1000,  35000],
  ['Quantum Cloud Infrastructure','IT',           800,  50000],
  ['Harbor Light Consulting',     'CONSULTING',  3000,  60000],
  ['Unity Healthcare Partners',   'CONSULTING',  2000,  30000],
  ['Delta Freight Services LLC',  'LOGISTICS',    300,  12000],
  ['Vanguard Analytics Inc',      'IT',          1500,  45000],
  ['Ridgeline Catering Co',       'FACILITIES',   200,   8000],
  ['Yellowstone Equipment Rental','OPERATIONS',   500,  20000],
  ['Pacific Rim Staffing',        'CONSULTING',  1000,  15000],
  ['Eagle Eye Security Systems',  'SECURITY',     500,  25000],
  ['Westbrook Print & Media',     'MARKETING',    300,  10000],
  ['Silverstone IT Services',     'IT',          1000,  30000],
  ['Oakwood Facilities Mgmt',     'FACILITIES',  1000,  18000],
  ['Horizon Training Solutions',  'CONSULTING',   500,  12000],
  ['Crestview Supplies Ltd',      'SUPPLIES',     100,   4000],
  ['Sterling Law Group',          'LEGAL',       1500,  30000],
  ['Redrock Data Solutions',      'IT',          2000,  40000],
  ['Avalon Research Associates',  'CONSULTING',  5000,  50000],
  ['Elmwood Graphics Studio',     'MARKETING',    500,  15000],
  ['Pinnacle Risk Advisors',      'FINANCE',     2000,  35000],
  ['Sunrise Fleet Management',    'LOGISTICS',    400,   8000],
];

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

// Seeded with Math.random() so every call produces a different dataset
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
  const t = Math.pow(rng(), 2.5); // skew toward lower amounts (realistic)
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
  const rng = makeRng(seed);

  let invCounter = 1000 + randInt(rng, 0, 200);
  const nextInv = () => `INV-${++invCounter}`;

  const rows: Row[] = [];

  const vendorWeights = VENDORS.map((_, i) => Math.max(1, 10 - Math.floor(i / 3)));

  // ── Normal transactions (~620) ─────────────────────────────────
  for (let i = 0; i < 620; i++) {
    const [vname, vcat, vlo, vhi] = weightedPick(rng, VENDORS, vendorWeights)!;
    const isSupicious = rng() < 0.1;
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      vname,
      amount:      randAmount(rng, vlo, vhi),
      description: isSupicious ? pick(rng, SUSP_DESCS) : pick(rng, LEGIT_DESCS),
      category:    rng() < 0.8 ? vcat : pick(rng, ['IT','LEGAL','MARKETING','CONSULTING','LOGISTICS','FINANCE','FACILITIES','SECURITY','OPERATIONS','SUPPLIES']),
      approved_by: pick(rng, APPROVERS),
    });
  }

  // ── Fraud Pattern 1: Exact Duplicates (8-12 groups) ───────────
  const dupCount = randInt(rng, 8, 12);
  for (let g = 0; g < dupCount; g++) {
    const [vname, vcat, vlo, vhi] = weightedPick(rng, VENDORS.slice(0, 10), vendorWeights.slice(0, 10))!;
    const amt  = randAmount(rng, vlo, vhi);
    const dt   = randDate(rng);
    const inv  = nextInv();
    const desc = pick(rng, LEGIT_DESCS);
    const appr = pick(rng, APPROVERS);
    const count = rng() < 0.3 ? 3 : 2;
    for (let k = 0; k < count; k++) {
      rows.push({ invoice_id: inv, date: dt, vendor: vname, amount: amt, description: desc, category: vcat, approved_by: appr });
    }
  }

  // ── Fraud Pattern 2: Fuzzy Vendor Names (3-5 pairs) ──────────
  const fuzzyVariants: Record<string, string> = {
    'Apex Technology Solutions':   'Apex Technology Solution',
    'Frontier Logistics Partners': 'Frontierr Logistics Partners',
    'Summit Financial Advisors':   'Summit Financial Advisory',
    'Meridian Legal Partners LLP': 'Meridian Legal Partners',
    'Cascade Digital Systems':     'Cascade Digital System',
  };
  const fuzzyKeys = Object.keys(fuzzyVariants);
  const fuzzyCount = randInt(rng, 3, 5);
  for (let f = 0; f < fuzzyCount; f++) {
    const realName = fuzzyKeys[f % fuzzyKeys.length]!;
    const fakeName = fuzzyVariants[realName]!;
    const vendor = VENDORS.find(v => v[0] === realName)!;
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

  // ── Fraud Pattern 3: Split Invoices (5-7 clusters) ───────────
  const splitScenarios: Array<[string, number, number, number, number]> = [
    // [vendor, threshold, n, amtLo, amtHi]
    ['Blue Ridge Analytics Group',  10000, 3, 9550, 9920],
    ['Summit Financial Advisors',    5000, 4, 4720, 4970],
    ['Cascade Digital Systems',     10000, 2, 9800, 9980],
    ['Apex Technology Solutions',   25000, 3, 24400, 24900],
    ['Harbor Light Consulting',     10000, 3, 9450, 9820],
    ['Ironwood Engineering Corp',   50000, 3, 49000, 49750],
    ['Meridian Legal Partners LLP', 10000, 2, 9700, 9960],
  ];
  const splitCount = randInt(rng, 5, 7);
  for (let s = 0; s < splitCount; s++) {
    const [vname, , n, lo, hi] = splitScenarios[s % splitScenarios.length]!;
    const vendor = VENDORS.find(v => v[0] === vname)!;
    const baseDate = randDate(rng);
    const invBase = nextInv();
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

  // ── Fraud Pattern 4: RSF Outliers (5-7) ──────────────────────
  const rsfCases: Array<[string, number, number]> = [
    ['Ridgeline Catering Co',       27000, 45000],
    ['Lakeview Office Supplies Co', 30000, 42000],
    ['Westbrook Print & Media',     25000, 38000],
    ['Crestview Supplies Ltd',      22000, 34000],
    ['Elmwood Graphics Studio',     28000, 40000],
    ['Sunrise Fleet Management',    20000, 32000],
    ['Yellowstone Equipment Rental',24000, 37000],
  ];
  const rsfCount = randInt(rng, 5, 7);
  for (let r = 0; r < rsfCount; r++) {
    const [vname, lo, hi] = rsfCases[r]!;
    const vendor = VENDORS.find(v => v[0] === vname)!;
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

  // ── Fraud Pattern 5: Round Numbers (20-30) ───────────────────
  const roundPool = [1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const roundCount = randInt(rng, 20, 30);
  for (let r = 0; r < roundCount; r++) {
    const [vname, vcat] = pick(rng, VENDORS.slice(0, 20))!;
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

  // ── Fraud Pattern 6: Near-threshold Amounts (15-20) ──────────
  const nearThreshPool: number[] = [];
  for (const t of [1000, 5000, 10000, 25000, 50000, 100000]) {
    for (let d = 1; d <= 20; d += 5) nearThreshPool.push(t - d);
  }
  const nearCount = randInt(rng, 15, 20);
  for (let n = 0; n < nearCount; n++) {
    const [vname, vcat] = pick(rng, VENDORS.slice(0, 15))!;
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

  // ── Fraud Pattern 7: Ghost Vendors (2-4 each) ────────────────
  const ghostVendors = [
    ['JJ Consulting LLC',          'CONSULTING', 8000, 48000],
    ['Quick Pay Services',         'OPERATIONS', 5000, 40000],
    ['General Business Solutions', 'SUPPLIES',   2000, 20000],
  ] as const;
  for (const [gv, gcat, glo, ghi] of ghostVendors) {
    for (let k = 0; k < randInt(rng, 2, 4); k++) {
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

  // ── Fraud Pattern 8: Benford Violation Cluster (20-25) ───────
  const benfordCount = randInt(rng, 20, 25);
  const benfordVendor = pick(rng, ['Summit Financial Advisors', 'Blue Ridge Analytics Group']);
  const benfordCat    = 'FINANCE';
  for (let b = 0; b < benfordCount; b++) {
    const startDigit = pick(rng, [7, 8, 9]);
    const lo = startDigit * 10000;
    const hi = lo + 9999;
    rows.push({
      invoice_id:  nextInv(),
      date:        randDate(rng),
      vendor:      benfordVendor,
      amount:      Math.round((lo + rng() * (hi - lo)) * 100) / 100,
      description: pick(rng, LEGIT_DESCS.slice(10, 30)),
      category:    benfordCat,
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

export function downloadSampleCsv(): void {
  const csv  = generateSampleCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'sample-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}
