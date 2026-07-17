import { it, expect } from "vitest";
import { createSimState, step } from "./engine";
// One bottleneck: concurrency 1, service 10ms => ~100 req/s max. Feed 150/s so a
// queue forms (capacity 1000 so few/no drops). Completed requests must show latency
// FAR above the 10ms service floor because they waited in the queue.
it("latency reflects queue wait under moderate overload", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 150 },
      { id: "db", componentId: "sql-db", serviceTimeMs: 10, concurrency: 1, capacity: 1000, failureRate: 0, isSource: false, isSink: false },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [{ id: "e1", source: "src", target: "db" }, { id: "e2", source: "db", target: "sink" }],
  });
  for (let t = 0; t < 3000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  const xs = s.metrics.latencySamples;
  expect(xs.length).toBeGreaterThan(50);
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  // queue grows ~50/s over 3s => waits reach hundreds of ms; avg must exceed the 10ms floor substantially
  expect(avg).toBeGreaterThan(50);
});
