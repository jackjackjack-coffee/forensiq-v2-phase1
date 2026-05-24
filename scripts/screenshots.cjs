// Drives the local dev server through the full Generate-Sample flow
// and captures README screenshots. Intercepts /api/external-verify
// with deterministic mock data (the upstream APIs — treasury.gov,
// sec.gov, nominatim — are not reachable from this sandbox; the mock
// returns the same shape the real route would on the live deploy).

const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT  = path.join(__dirname, '..', 'docs', 'screenshots');
const VIEWPORT = { width: 1600, height: 1000 };
const MAX_GEN_ATTEMPTS = 8;

// Mock external verification. Names that look like SEC filers → EDGAR
// matched. Names containing well-known SDN substrings → OFAC hit.
// Addresses with residential / mail-drop markers → Nominatim invalid.
function mockVerify(reqJson) {
  const SEC_FILER_KEYWORDS = [
    'microsoft', 'oracle', 'salesforce', 'adobe', 'cisco', 'ibm', 'apple',
    'nvidia', 'alphabet', 'meta', 'tesla', 'intel', 'deloitte', 'pricewaterhouse',
    'ernst', 'kpmg', 'accenture', 'mckinsey', 'goldman', 'jpmorgan', 'morgan stanley',
    'blackrock', 'fedex', 'parcel service', 'honeywell', 'johnson', 'pfizer',
    'visa', 'mastercard', 'amazon', 'google', 'sap', 'amd', 'broadcom',
    'qualcomm', 'walmart', 'costco', 'starbucks', 'nike', 'unilever',
    'nestle', 'exxonmobil', 'chevron', 'paypal', 'schwab', 'fidelity',
  ];
  const SDN_KEYWORDS = [
    'bank melli', 'sepah', 'kapitalbank', 'svyazbank', 'rosneft', 'irgc',
  ];
  const SUSPICIOUS_ADDR_KEYWORDS = [
    'evergreen terrace', 'mockingbird', 'bikini bottom', 'phantom ave',
    'mailbox pl', 'forwarding suite', 'nowhere rd', 'apt 3b',
  ];

  const edgar = {};
  for (const v of reqJson.vendors ?? []) {
    const lower = v.toLowerCase();
    const matched = SEC_FILER_KEYWORDS.some((k) => lower.includes(k));
    edgar[v] = { matched, confidence: matched ? 0.95 : 0.0 };
  }
  const ofac = {};
  for (const v of reqJson.vendors ?? []) {
    const lower = v.toLowerCase();
    const hit = SDN_KEYWORDS.some((k) => lower.includes(k));
    ofac[v] = hit
      ? { hit: true, matched_name: 'Sanctioned Entity (demo match)', list_type: 'Entity' }
      : { hit: false };
  }
  const nominatim = {};
  for (const a of reqJson.addresses ?? []) {
    const lower = a.toLowerCase();
    const suspicious = SUSPICIOUS_ADDR_KEYWORDS.some((k) => lower.includes(k));
    nominatim[a] = { valid: !suspicious };
  }
  return { edgar, ofac, nominatim };
}

async function waitForAnalysisDone(page) {
  // Playwright's waitForFunction signature is (fn, arg, options) — passing
  // {timeout} as the second arg silently uses the 30s default. Pass undefined
  // for `arg` so the options object lands in the right slot.
  await page.waitForFunction(
    () => !document.body.innerText.includes('RUNNING FORENSIC ANALYSIS'),
    undefined,
    { timeout: 180_000 },
  );
  await page.waitForFunction(
    () => /Forensic Analysis Complete|RESULTS READY/i.test(document.body.innerText),
    undefined,
    { timeout: 90_000 },
  );
}

async function generateInterestingSample(page) {
  for (let attempt = 1; attempt <= MAX_GEN_ATTEMPTS; attempt++) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.click('button:has-text("GENERATE")');
    await page.waitForSelector('button:has-text("RUN FORENSIC ANALYSIS")', { timeout: 15_000 });
    await page.click('button:has-text("RUN FORENSIC ANALYSIS")');
    await waitForAnalysisDone(page);

    const stats = await page.evaluate(() => (window).__forensiq_lastSampleStats);
    console.log(`  attempt ${attempt}:`, stats);
    if (stats && stats.ofacFuzzyShells >= 1 && stats.suspiciousAddresses >= 1) {
      console.log('  ✓ kept this run');
      return stats;
    }
  }
  console.log('  ⚠ no ideal run found, keeping the last one');
  return null;
}

async function shoot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('  →', file);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });

  // Intercept /api/external-verify with deterministic mocks.
  await ctx.route('**/api/external-verify', async (route) => {
    let body = {};
    try { body = await route.request().postDataJSON(); } catch {}
    const resp = mockVerify(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(resp),
    });
  });

  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [browser-err]', msg.text().slice(0, 120));
  });

  // ── 1. hero-upload ──────────────────────────────────────────────
  console.log('\n[1/7] hero-upload.png');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=DROP CSV FILE', { timeout: 15_000 });
  await shoot(page, 'hero-upload');

  // ── 2. parser-feedback card (pending state after GENERATE) ──────
  console.log('\n[2/7] parser-feedback.png');
  await page.click('button:has-text("GENERATE")');
  await page.waitForSelector('button:has-text("RUN FORENSIC ANALYSIS")', { timeout: 15_000 });
  // Card renders right above the RUN button; give a beat for layout
  // Card uses CSS-uppercased "Parser detected" — Playwright text= matches case-insensitively
  await page.waitForSelector('text=Parser detected', { timeout: 5_000 });
  await page.waitForTimeout(400);
  await shoot(page, 'parser-feedback');

  // ── 3 + 4. interesting sample → overview ───────────────────────
  console.log('\n[3/7] generating an interesting sample…');
  await generateInterestingSample(page);

  await page.click('button:has-text("VIEW RESULTS"), a[href="/overview"]');
  await page.waitForURL(/\/overview/, { timeout: 15_000 });
  await page.waitForSelector('text=Portfolio', { timeout: 15_000 });
  await page.waitForTimeout(1200); // charts render

  console.log('\n[4/7] overview-score.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot(page, 'overview-score');

  console.log('\n[5/7] overview-charts.png');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.45));
  await page.waitForTimeout(500);
  await shoot(page, 'overview-charts');

  // ── 6. transactions + detail panel ──────────────────────────────
  console.log('\n[6/7] transaction-detail.png');
  await page.goto(`${BASE}/transactions`, { waitUntil: 'networkidle' });
  await page.waitForSelector('table tbody tr', { timeout: 15_000 });
  // First row is highest-risk (default sort) — likely an OFAC-flagged shell
  await page.locator('table tbody tr').first().click();
  await page.waitForTimeout(800);
  // Detail panel renders below the table; scroll to bottom so it's in frame.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shoot(page, 'transaction-detail');

  // ── 7. benford ──────────────────────────────────────────────────
  console.log('\n[7/7] benford.png');
  await page.goto(`${BASE}/benford`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shoot(page, 'benford');

  console.log('\n[bonus] detectors.png');
  await page.goto(`${BASE}/detectors`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shoot(page, 'detectors');

  await browser.close();
  console.log('\n✓ done');
})().catch((e) => { console.error('script failed:', e); process.exit(1); });
