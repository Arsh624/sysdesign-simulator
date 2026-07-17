import { it, expect } from "vitest";
import { applyChaos } from "./chaos";
import { createSimState } from "./engine";

function base() {
  return createSimState({
    nodes: [{ id: "db", componentId: "sql-db", serviceTimeMs: 10, concurrency: 5, capacity: 100, failureRate: 0, isSource: false, isSink: false }],
    edges: [],
  });
}

it("latency spike multiplies service time; recover restores", () => {
  const s = base();
  const original = s.nodes.db.serviceTimeMs;
  applyChaos(s, { kind: "latency-spike", nodeId: "db", factor: 5 });
  expect(s.nodes.db.serviceTimeMs).toBe(original * 5);
  applyChaos(s, { kind: "recover", nodeId: "db" });
  expect(s.nodes.db.serviceTimeMs).toBe(original);
});

it("crash sets capacity to 0", () => {
  const s = base();
  applyChaos(s, { kind: "crash", nodeId: "db" });
  expect(s.nodes.db.capacity).toBe(0);
});
