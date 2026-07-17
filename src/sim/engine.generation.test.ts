import { describe, it, expect } from "vitest";
import { createSimState, step } from "./engine";

// Source (rate 100 req/s) -> Sink. Over 1000ms at trafficMultiplier 1,
// ~100 requests should be generated and reach the sink.
it("source generates ~rate requests per second", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000,
        capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 100 },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000,
        capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [{ id: "e1", source: "src", target: "sink" }],
  });
  for (let t = 0; t < 1000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  expect(s.metrics.completed).toBeGreaterThanOrEqual(90);
  expect(s.metrics.completed).toBeLessThanOrEqual(110);
  expect(s.metrics.dropped).toBe(0);
});
