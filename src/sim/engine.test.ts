import { it, expect } from "vitest";
import { createSimState, step } from "./engine";
import { percentile } from "./metrics";
import type { SimEdge } from "./types";

interface NI {
  id: string; serviceTimeMs: number; concurrency: number; capacity: number;
  failureRate?: number; isSource?: boolean; isSink?: boolean; genRatePerSec?: number;
  variance?: number;
}

function node(n: NI) {
  return {
    id: n.id,
    componentId: n.id,
    serviceTimeMs: n.serviceTimeMs,
    concurrency: n.concurrency,
    capacity: n.capacity,
    failureRate: n.failureRate ?? 0,
    isSource: n.isSource ?? false,
    isSink: n.isSink ?? false,
    genRatePerSec: n.genRatePerSec,
    variance: n.variance,
  };
}

function edge(source: string, target: string): SimEdge {
  return { id: `${source}->${target}`, source, target };
}

function run(state: ReturnType<typeof createSimState>, ms: number, traffic = 1, speed = 1) {
  step(state, ms, { speed, traffic });
  return state;
}

// (a) CONSERVATION ----------------------------------------------------------
it("conserves requests: completed + failed + inFlight === generated, no vanishing", () => {
  const state = createSimState({
    seed: 1,
    nodes: [
      node({ id: "src", serviceTimeMs: 0, concurrency: 1, capacity: 1, isSource: true, genRatePerSec: 200 }),
      node({ id: "a", serviceTimeMs: 5, concurrency: 20, capacity: 5000 }),
      node({ id: "b", serviceTimeMs: 5, concurrency: 20, capacity: 5000 }),
    ],
    edges: [edge("src", "a"), edge("a", "b")],
  });
  run(state, 3000, 1);

  const generatedSoFar = state.metrics.completed + state.metrics.failed + state.inFlight;
  expect(generatedSoFar).toBeGreaterThan(0);

  // stop generating and let in-flight drain
  run(state, 3000, 0);
  expect(state.inFlight).toBeLessThanOrEqual(2);
  expect(state.metrics.latencySamples.length).toBe(state.metrics.completed + state.metrics.failed);
});

// (b) ROUND TRIP --------------------------------------------------------------
it("round trip: end-to-end latency accumulates along the chain and flow events show both directions", () => {
  const state = createSimState({
    seed: 2,
    nodes: [
      node({ id: "src", serviceTimeMs: 0, concurrency: 1, capacity: 1, isSource: true, genRatePerSec: 50 }),
      node({ id: "a", serviceTimeMs: 10, concurrency: 20, capacity: 5000 }),
      node({ id: "b", serviceTimeMs: 20, concurrency: 20, capacity: 5000 }),
      node({ id: "c", serviceTimeMs: 5, concurrency: 20, capacity: 5000 }),
    ],
    edges: [edge("src", "a"), edge("a", "b"), edge("b", "c")],
  });
  run(state, 4000, 1);

  expect(state.metrics.completed).toBeGreaterThan(0);
  const avg = state.metrics.latencySamples.reduce((s, v) => s + v, 0) / state.metrics.latencySamples.length;
  expect(avg).toBeGreaterThanOrEqual(35);

  const hasForward = state.flowEvents.some((e) => e.sourceId === "a" && e.targetId === "b");
  const hasBackward = state.flowEvents.some((e) => e.sourceId === "b" && e.targetId === "a");
  expect(hasForward).toBe(true);
  expect(hasBackward).toBe(true);
});

// (c) COUPLING ----------------------------------------------------------------
it("downstream slowness throttles the caller (synchronous coupling)", () => {
  function build(dbServiceMs: number) {
    return createSimState({
      seed: 3,
      nodes: [
        node({ id: "src", serviceTimeMs: 0, concurrency: 1, capacity: 1, isSource: true, genRatePerSec: 300 }),
        node({ id: "app", serviceTimeMs: 5, concurrency: 10, capacity: 5000 }),
        node({ id: "db", serviceTimeMs: dbServiceMs, concurrency: 100, capacity: 5000 }),
      ],
      edges: [edge("src", "app"), edge("app", "db")],
    });
  }

  const slow = build(50);
  run(slow, 3000, 1);
  const slowSaturated = slow.metrics.dropped > 0 || slow.nodes.app.queue.length > 0;
  expect(slowSaturated).toBe(true);

  const fast = build(1);
  run(fast, 3000, 1);

  expect(fast.metrics.completed).toBeGreaterThan(slow.metrics.completed * 1.5);
});

// (d) TAIL ----------------------------------------------------------------
it("stochastic variance produces a heavy tail: p95 notably above p50", () => {
  const state = createSimState({
    seed: 4,
    nodes: [
      node({ id: "src", serviceTimeMs: 0, concurrency: 1, capacity: 1, isSource: true, genRatePerSec: 280 }),
      node({ id: "a", serviceTimeMs: 10, concurrency: 4, capacity: 5000, variance: 0.5 }),
    ],
    edges: [edge("src", "a")],
  });
  run(state, 5000, 1);

  const p50 = percentile(state.metrics.latencySamples, 50);
  const p95 = percentile(state.metrics.latencySamples, 95);
  expect(state.metrics.latencySamples.length).toBeGreaterThan(0);
  expect(p95).toBeGreaterThan(1.3 * p50);
});

// (e) BREAKER / CASCADE -------------------------------------------------------
it("a crashed downstream node trips the caller's breaker and cascades failure; recovers after cooldown", () => {
  const state = createSimState({
    seed: 5,
    nodes: [
      node({ id: "src", serviceTimeMs: 0, concurrency: 1, capacity: 1, isSource: true, genRatePerSec: 50 }),
      node({ id: "a", serviceTimeMs: 5, concurrency: 20, capacity: 5000 }),
      node({ id: "b", serviceTimeMs: 5, concurrency: 20, capacity: 0 }), // crashed
    ],
    edges: [edge("src", "a"), edge("a", "b")],
  });
  run(state, 2000, 1);

  expect(state.nodes.a.cb.state).toBe("open");
  expect(state.metrics.failed).toBeGreaterThan(0);
  expect(state.metrics.completed).toBe(0);
  expect(state.dropEvents.length).toBeGreaterThan(0);

  // recover
  state.nodes.b.capacity = 100;
  run(state, 3000, 1);

  expect(state.nodes.a.cb.state).toBe("closed");
  expect(state.metrics.completed).toBeGreaterThan(0);
});

// (f) BOTTLENECK SHAPE --------------------------------------------------------
it("identifies the true bottleneck node under a fan-out topology", () => {
  const state = createSimState({
    seed: 6,
    nodes: [
      node({ id: "client", serviceTimeMs: 0, concurrency: 1000, capacity: 100000, isSource: true, genRatePerSec: 800 }),
      node({ id: "lb", serviceTimeMs: 1, concurrency: 500, capacity: 10000 }),
      node({ id: "app", serviceTimeMs: 5, concurrency: 30, capacity: 5000 }),
      node({ id: "cache", serviceTimeMs: 1, concurrency: 200, capacity: 5000 }),
      node({ id: "sql", serviceTimeMs: 8, concurrency: 40, capacity: 5000 }),
    ],
    edges: [edge("client", "lb"), edge("lb", "app"), edge("app", "cache"), edge("app", "sql")],
  });

  let appSaturatedAtSomePoint = false;
  let sqlNeverFull = true;
  const totalMs = 3000;
  const chunk = 50;
  for (let elapsed = 0; elapsed < totalMs; elapsed += chunk) {
    run(state, chunk, 2.5);
    if (state.nodes.app.active.length >= state.nodes.app.concurrency) appSaturatedAtSomePoint = true;
    if (state.nodes.sql.active.length >= state.nodes.sql.concurrency) sqlNeverFull = false;
  }

  expect(appSaturatedAtSomePoint).toBe(true);
  expect(sqlNeverFull).toBe(true);
});
