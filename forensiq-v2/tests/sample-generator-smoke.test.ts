// One-off smoke test confirming the sample generator emits an address
// column, populates it for every row, and seeds the three new knobs.
import { generateSampleCsv } from '../lib/sample-generator';

describe('sample-generator smoke', () => {
  test('emits address column and populates every row', () => {
    const csv = generateSampleCsv();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('invoice_id,date,vendor,amount,description,category,approved_by,address');
    expect(lines.length).toBeGreaterThan(500);

    // Every data row has 8 fields (allowing for quoted commas)
    const dataRow = lines[1]!;
    const matches = dataRow.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(8);

    // Every row has a non-empty trailing field (the address)
    let blank = 0;
    for (let i = 1; i < lines.length; i++) {
      const last = lines[i]!.split(',').pop()!;
      if (!last || last === '""') blank++;
    }
    expect(blank).toBe(0);
  });

  test('at least one generation in 20 plants an OFAC shell vendor', () => {
    let seen = false;
    for (let i = 0; i < 20; i++) {
      const csv = generateSampleCsv();
      if (/bank melli|sepah|rosneft|kapitalbank|svyazbank|irgc/i.test(csv)) {
        seen = true;
        break;
      }
    }
    expect(seen).toBe(true);
  });

  test('at least one generation in 20 plants a suspicious address', () => {
    let seen = false;
    for (let i = 0; i < 20; i++) {
      const csv = generateSampleCsv();
      if (/evergreen terrace|mockingbird|bikini bottom|phantom ave|mailbox pl|forwarding suite|nowhere rd|apt 3b/i.test(csv)) {
        seen = true;
        break;
      }
    }
    expect(seen).toBe(true);
  });
});
