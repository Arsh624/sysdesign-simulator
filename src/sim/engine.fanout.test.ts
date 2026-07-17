import { it, expect } from "vitest";
import { createSimState, step } from "./engine";
// src -> split(0ms) -> {A(5ms) -> sinkA, B(5ms) -> sinkB}. Round-robin should split
// traffic roughly evenly between the two branches. We assert on busyMsThisWindow of
// the non-sink branch nodes A and B, which accumulates per-node in the engine (not
// reset except by the runner), as a proxy for how much traffic each branch handled.
it("round-robins traffic across multiple outgoing edges", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 200 },
      { id: "split", componentId: "load-balancer", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: false },
      { id: "a", componentId: "app-server", serviceTimeMs: 5, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: false },
      { id: "b", componentId: "app-server", serviceTimeMs: 5, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: false },
      { id: "sinkA", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
      { id: "sinkB", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [
      { id: "e1", source: "src", target: "split" },
      { id: "e2", source: "split", target: "a" },
      { id: "e3", source: "split", target: "b" },
      { id: "e4", source: "a", target: "sinkA" },
      { id: "e5", source: "b", target: "sinkB" },
    ],
  });
  for (let t = 0; t < 1000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  expect(s.metrics.completed).toBeGreaterThan(150);
  const busyA = s.nodes.a.busyMsThisWindow;
  const busyB = s.nodes.b.busyMsThisWindow;
  expect(busyA).toBeGreaterThan(0);
  expect(busyB).toBeGreaterThan(0);
  const ratio = Math.max(busyA, busyB) / Math.min(busyA, busyB);
  expect(ratio).toBeLessThan(2);
});
