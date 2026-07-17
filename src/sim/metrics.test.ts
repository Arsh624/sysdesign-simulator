import { it, expect } from "vitest";
import { percentile, summarize } from "./metrics";

it("computes percentiles", () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  expect(percentile(xs, 50)).toBeCloseTo(50, 0);
  expect(percentile(xs, 95)).toBeCloseTo(95, 0);
  expect(percentile(xs, 99)).toBeCloseTo(99, 0);
  expect(percentile([], 95)).toBe(0);
});

it("summarizes drop rate and throughput", () => {
  const m = summarize(
    { completed: 90, dropped: 10, failed: 0, latencySamples: [10, 20, 30], throughputWindow: [], simTimeMs: 1000 },
  );
  expect(m.dropRate).toBeCloseTo(0.1, 5);
  expect(m.p50).toBeGreaterThan(0);
});
