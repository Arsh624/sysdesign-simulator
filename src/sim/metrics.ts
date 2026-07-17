import { Metrics } from "./types";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const xs = [...sorted].sort((a, b) => a - b);
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil((p / 100) * xs.length) - 1));
  return xs[idx];
}

export interface MetricSummary {
  completed: number;
  dropped: number;
  failed: number;
  dropRate: number;
  p50: number;
  p95: number;
  p99: number;
}

export function summarize(m: Metrics): MetricSummary {
  const total = m.completed + m.dropped;
  return {
    completed: m.completed,
    dropped: m.dropped,
    failed: m.failed,
    dropRate: total === 0 ? 0 : m.dropped / total,
    p50: percentile(m.latencySamples, 50),
    p95: percentile(m.latencySamples, 95),
    p99: percentile(m.latencySamples, 99),
  };
}
