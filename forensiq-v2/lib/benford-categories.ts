// lib/benford-categories.ts
// ─────────────────────────────────────────────────────────────────
// Nigrini's MAD conformity ranges for Benford's Law.
// Source: Mark Nigrini, "Benford's Law: Applications for Forensic
// Accounting, Auditing, and Fraud Detection" (Wiley, 2012).
// ─────────────────────────────────────────────────────────────────

export interface MadCategory {
  label: string;
  description: string;
  range: string;
  color: string; // tailwind class fragment
}

export const BENFORD_1ST_CATEGORIES: MadCategory[] = [
  { label: 'Close conformity',      range: '0.000 – 0.006', description: 'Data follows Benford very closely.',          color: 'emerald' },
  { label: 'Acceptable conformity', range: '0.006 – 0.012', description: 'Within tolerance for natural data.',          color: 'emerald' },
  { label: 'Marginal conformity',   range: '0.012 – 0.015', description: 'Borderline — investigate further.',           color: 'yellow'  },
  { label: 'Non-conformity',        range: '> 0.015',       description: 'Significant deviation — possible manipulation.', color: 'red'  },
];

export const BENFORD_2ND_CATEGORIES: MadCategory[] = [
  { label: 'Close conformity',      range: '0.000 – 0.008', description: 'Data follows Benford very closely.',          color: 'emerald' },
  { label: 'Acceptable conformity', range: '0.008 – 0.010', description: 'Within tolerance for natural data.',          color: 'emerald' },
  { label: 'Marginal conformity',   range: '0.010 – 0.012', description: 'Borderline — investigate further.',           color: 'yellow'  },
  { label: 'Non-conformity',        range: '> 0.012',       description: 'Significant deviation — possible manipulation.', color: 'red'  },
];

export function categorizeMad(mad: number, position: 1 | 2): MadCategory {
  const cats = position === 1 ? BENFORD_1ST_CATEGORIES : BENFORD_2ND_CATEGORIES;
  const thresholds = position === 1 ? [0.006, 0.012, 0.015] : [0.008, 0.010, 0.012];
  if (mad < thresholds[0]!) return cats[0]!;
  if (mad < thresholds[1]!) return cats[1]!;
  if (mad < thresholds[2]!) return cats[2]!;
  return cats[3]!;
}
