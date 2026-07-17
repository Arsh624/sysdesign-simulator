import { describe, it, expect } from "vitest";
import { createSimState, step } from "./engine";

describe("per-node telemetry accounting", () => {
  it("tracks completedCount and latencyWindow samples >= service time", () => {
    const state = createSimState({
      nodes: [
        { id: "src", componentId: "source", serviceTimeMs: 0, concurrency: 1, capacity: 1000, failureRate: 0, isSource: true, isSink: false, genRatePerSec: 20 },
        { id: "a", componentId: "svc", serviceTimeMs: 5, concurrency: 100, capacity: 1000, failureRate: 0, isSource: false, isSink: false },
        { id: "sink", componentId: "sink", serviceTimeMs: 0, concurrency: 1, capacity: 1000, failureRate: 0, isSource: false, isSink: true },
      ],
      edges: [
        { id: "e1", source: "src", target: "a" },
        { id: "e2", source: "a", target: "sink" },
      ],
    });

    step(state, 1000, { speed: 1, traffic: 1 });

    const a = state.nodes.a;
    expect(a.completedCount).toBeGreaterThan(0);
    expect(a.latencyWindow.length).toBeGreaterThan(0);
    for (const sample of a.latencyWindow) {
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(5);
    }
  });
});
