import { it, expect } from "vitest";
import { createSimState, step } from "./engine";

// A node with concurrency 1, serviceTime 10ms, capacity 2, fed 500 req/s.
// It can serve ~100 req/s max (1 in-flight / 10ms). Fed at 500/s it saturates
// and drops the excess because capacity is only 2.
it("drops requests when a node saturates beyond capacity", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 500 },
      { id: "db", componentId: "sql-db", serviceTimeMs: 10, concurrency: 1, capacity: 2, failureRate: 0, isSource: false, isSink: false },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [{ id: "e1", source: "src", target: "db" }, { id: "e2", source: "db", target: "sink" }],
  });
  for (let t = 0; t < 1000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  // ~100 served, rest dropped; conservation holds.
  expect(s.metrics.completed).toBeGreaterThan(80);
  expect(s.metrics.completed).toBeLessThan(120);
  expect(s.metrics.dropped).toBeGreaterThan(300);
  expect(s.metrics.completed + s.metrics.dropped).toBeCloseTo(500, -2);
});
