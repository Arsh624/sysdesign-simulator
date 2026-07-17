import { it, expect } from "vitest";
import { createSimState, step } from "./engine";

it("emits a flow event per edge traversal with correct endpoints", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 20 },
      { id: "a", componentId: "app-server", serviceTimeMs: 2, concurrency: 100, capacity: 1000, failureRate: 0, isSource: false, isSink: false },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [{ id: "e1", source: "src", target: "a" }, { id: "e2", source: "a", target: "sink" }],
  });
  for (let t = 0; t < 1000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  expect(s.flowEvents.length).toBeGreaterThan(0);
  expect(s.flowEvents.some(e => e.sourceId === "src" && e.targetId === "a")).toBe(true);
  expect(s.flowEvents.some(e => e.sourceId === "a" && e.targetId === "sink")).toBe(true);
});

it("emits a drop event for every dropped request", () => {
  let s = createSimState({
    nodes: [
      { id: "src", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 500 },
      { id: "db", componentId: "sql-db", serviceTimeMs: 10, concurrency: 1, capacity: 2, failureRate: 0, isSource: false, isSink: false },
      { id: "sink", componentId: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, failureRate: 0, isSource: false, isSink: true },
    ],
    edges: [{ id: "e1", source: "src", target: "db" }, { id: "e2", source: "db", target: "sink" }],
  });
  for (let t = 0; t < 1000; t += 50) s = step(s, 50, { speed: 1, traffic: 1 });
  expect(s.dropEvents.length).toBe(s.metrics.dropped);
});
