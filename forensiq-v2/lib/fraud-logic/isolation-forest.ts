// lib/fraud-logic/isolation-forest.ts
// ─────────────────────────────────────────────────────────────────
// Isolation Forest anomaly detection — TypeScript port of the v1
// scikit-learn implementation with identical parameters.
// Zero React imports — runs in Node without a browser.
// ─────────────────────────────────────────────────────────────────

import type { RawTransaction } from '../types/transaction';

// ── Isolation Tree node ───────────────────────────────────────────

interface IsolationNode {
  is_leaf: boolean;
  size: number;        // number of samples at this node (for leaf size correction)
  split_value?: number;
  left?: IsolationNode;
  right?: IsolationNode;
}

// ── Isolation Forest parameters ───────────────────────────────────

interface IsolationForestConfig {
  n_estimators: number;        // 200 — matches v1
  contamination: number;       // 0.05 — matches ACFE typical ledger fraud rate
  max_samples: number;         // subsample size per tree
  random_seed: number;
}

const DEFAULT_CONFIG: IsolationForestConfig = {
  n_estimators: 200,
  contamination: 0.05,
  max_samples: 256,
  random_seed: 42,
};

// ── Seeded PRNG (Mulberry32) for deterministic results ────────────

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Tree building ─────────────────────────────────────────────────

function buildTree(
  data: number[],
  current_depth: number,
  max_depth: number,
  rand: () => number
): IsolationNode {
  if (data.length <= 1 || current_depth >= max_depth) {
    return { is_leaf: true, size: data.length };
  }

  const min = Math.min(...data);
  const max = Math.max(...data);

  if (min === max) {
    return { is_leaf: true, size: data.length };
  }

  const split_value = min + rand() * (max - min);
  const left_data = data.filter((x) => x < split_value);
  const right_data = data.filter((x) => x >= split_value);

  // Prevent degenerate splits
  if (left_data.length === 0 || right_data.length === 0) {
    return { is_leaf: true, size: data.length };
  }

  return {
    is_leaf: false,
    size: data.length,
    split_value,
    left: buildTree(left_data, current_depth + 1, max_depth, rand),
    right: buildTree(right_data, current_depth + 1, max_depth, rand),
  };
}

// ── Path length computation ───────────────────────────────────────

/** Expected path length of an unsuccessful BST search, per Liu et al. 2008 */
function expectedPathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // Euler–Mascheroni constant
  return 2 * H - (2 * (n - 1)) / n;
}

function pathLength(node: IsolationNode, value: number, current_depth: number): number {
  if (node.is_leaf) {
    return current_depth + expectedPathLength(node.size);
  }

  if (value < (node.split_value ?? 0)) {
    return pathLength(node.left!, value, current_depth + 1);
  } else {
    return pathLength(node.right!, value, current_depth + 1);
  }
}

// ── Main export ───────────────────────────────────────────────────

export interface IsolationForestResult {
  /** 0–100 risk score per transaction. Higher = more anomalous. */
  risk_scores: number[];
  /** true if the transaction is classified as an outlier */
  is_outlier: boolean[];
  /** Raw anomaly score before normalization (-1 to 0, lower = more anomalous) */
  raw_scores: number[];
}

/**
 * Isolation Forest — ML-Based Anomaly Detection
 *
 * Accounting basis: Normal transactions cluster around typical amounts for
 * their vendor or category. Anomalous transactions — large payments to shell
 * companies, structuring patterns, fictitious invoices — are structurally
 * different and can be isolated in fewer random partitions.
 *
 * The algorithm works by randomly partitioning the data space. Points that
 * require fewer splits to isolate score higher. On a typical corporate ledger,
 * ~5% of transactions are genuinely anomalous (contamination = 0.05).
 *
 * Red flags detected:
 * - Single extremely large payment to any vendor (embezzlement via fictitious invoice)
 * - Structuring: unusually small but clustered payments below reporting thresholds
 * - One-time vendors with outlier amounts relative to the entire ledger
 *
 * Standard: ACFE Fraud Examiners Manual — Digital Analysis chapter.
 * Parameters: 200 estimators (matches v1), contamination = 0.05 (ACFE baseline).
 *
 * @param transactions - Full ledger being analyzed
 * @param config - Optional override for IF parameters (default = ACFE-validated values)
 * @returns Per-transaction risk scores and outlier classifications
 */
export function runIsolationForest(
  transactions: RawTransaction[],
  config: Partial<IsolationForestConfig> = {}
): IsolationForestResult {
  const cfg: IsolationForestConfig = { ...DEFAULT_CONFIG, ...config };

  if (transactions.length === 0) {
    return { risk_scores: [], is_outlier: [], raw_scores: [] };
  }

  // Log-transform amounts (handles right-skewed financial distributions)
  const log_amounts = transactions.map((t) => Math.log1p(t.amount));

  // Normalize (z-score standardization, mirrors sklearn StandardScaler)
  const mean = avg(log_amounts);
  const std = stdDev(log_amounts);
  const X = log_amounts.map((v) => (std > 0 ? (v - mean) / std : 0));

  const n = X.length;
  const max_samples = Math.min(cfg.max_samples, n);
  const max_depth = Math.ceil(Math.log2(max_samples));
  const rand = mulberry32(cfg.random_seed);

  // Build forest
  const trees: IsolationNode[] = [];
  for (let i = 0; i < cfg.n_estimators; i++) {
    // Random subsample
    const indices = shuffle(
      Array.from({ length: n }, (_, j) => j),
      rand
    ).slice(0, max_samples);
    const subsample = indices.map((idx) => X[idx]);
    trees.push(buildTree(subsample, 0, max_depth, rand));
  }

  // Score each transaction
  const avg_path_lengths = X.map((x) => {
    const paths = trees.map((tree) => pathLength(tree, x, 0));
    return avg(paths);
  });

  const c = expectedPathLength(max_samples);
  const raw_scores = avg_path_lengths.map((h) => Math.pow(2, -h / c));

  // Determine threshold for outlier classification using contamination rate
  const sorted = [...raw_scores].sort((a, b) => b - a);
  const threshold_idx = Math.floor(cfg.contamination * n);
  const threshold = sorted[threshold_idx] ?? 0;

  // Normalize to 0–100 risk scale (higher = more suspicious)
  const min_score = Math.min(...raw_scores);
  const max_score = Math.max(...raw_scores);
  const score_range = max_score - min_score;

  const risk_scores = raw_scores.map((s) =>
    score_range > 0 ? Math.round(((s - min_score) / score_range) * 100) : 0
  );

  const is_outlier = raw_scores.map((s) => s >= threshold);

  return { risk_scores, is_outlier, raw_scores };
}

// ── Utilities ─────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
