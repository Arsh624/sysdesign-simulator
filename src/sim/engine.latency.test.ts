import { it, expect } from "vitest";
import { createSimState, step } from "./engine";

// src -> A(5ms) -> B(8ms) -> sink, low traffic (no queueing).
// End-to-end latency per request should be ~13ms.
it("accumulates latency across hops", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 5 },
      { id: "a", componentId: "app-server", serviceTimeMs: 5, concurrency: 100, capacity: 1000, failureRate: 0, isSource: false, isSink: false },
      { id: "b", componentId: "sql-db", serviceTimeMs: 8, concurrency: 100, capacity: 1000, failureRate: 0, isSource: false, isSink: false },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [
      { id: "e1", source: "src", target: "a" },
      { id: "e2", source: "a", target: "b" },
      { id: "e3", source: "b", target: "sink" },
    ],
  });
  for (let t = 0; t < 2000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  const avg = s.metrics.latencySamples.reduce((x, y) => x + y, 0) / s.metrics.latencySamples.length;
  expect(avg).toBeGreaterThanOrEqual(13);
  expect(avg).toBeLessThanOrEqual(20); // allow sub-step rounding
});
