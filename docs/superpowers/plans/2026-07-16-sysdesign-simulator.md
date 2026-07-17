# System Design Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, offline, unlimited system-design interview-practice tool: drag components onto a canvas, connect them, run traffic through the design, and watch latency/throughput/bottlenecks under load and injected chaos.

**Architecture:** Vite + React + TypeScript SPA. React Flow renders an explicit node/edge graph. A framework-agnostic TypeScript simulation engine (`src/sim/`) runs a fixed-timestep queueing model, driven each frame by a `requestAnimationFrame` runner. Zustand holds design + sim state. Recharts renders live metrics. Everything persists to localStorage; no backend, no accounts, no quota.

**Tech Stack:** Vite, React 18, TypeScript, React Flow (`@xyflow/react`), Zustand, Recharts, Tailwind CSS, Vitest.

---

## File Structure

```
src/
  sim/
    types.ts          # SimState, SimNode, SimEdge, RequestToken, Metrics
    engine.ts         # pure step(state, dtMs) => state; the queueing model
    metrics.ts        # percentile/throughput/drop aggregation over a rolling window
    chaos.ts          # chaos modifier application
    runner.ts         # RAF loop wrapper that drives engine.step and emits snapshots
  palette/
    catalog.ts        # full component taxonomy as pure data (defaults per component)
    types.ts          # ComponentDef, Category
  store/
    designStore.ts    # nodes/edges/selection (Zustand)
    simStore.ts       # run state, speed, traffic, chaos, latest metrics (Zustand)
  canvas/
    Canvas.tsx        # React Flow wrapper
    SystemNode.tsx    # custom node renderer (colored by utilization)
    dnd.ts            # drag-from-palette helpers
  ui/
    Palette.tsx       # left grouped/collapsible palette
    Inspector.tsx     # right: selected node param editor
    MetricsPanel.tsx  # right: numbers + Recharts charts
    ControlBar.tsx    # top: start/pause/step, speed, traffic, chaos, presets, save
    ChaosControls.tsx # chaos buttons + recover
  presets/
    index.ts          # preset registry
    url-shortener.json
    news-feed.json
    chat.json
  persistence/
    storage.ts        # localStorage autosave + named designs + JSON export/import
  App.tsx
  main.tsx
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `vitest.config.ts`

- [ ] **Step 1: Scaffold Vite React-TS project**

Run:
```bash
npm create vite@latest . -- --template react-ts
```
If the directory is non-empty, choose "Ignore files and continue".

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install @xyflow/react zustand recharts
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

In `tailwind.config.js` set:
```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```
Replace `src/index.css` top with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "jsdom", globals: true },
});
```
Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Verify dev server + test runner boot**

Run: `npm run build`
Expected: build succeeds with no type errors.
Run: `npm run test`
Expected: "No test files found" (exit 0) — runner works.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite React-TS + tailwind + vitest"
```

---

## Task 2: Palette catalog (pure data)

**Files:**
- Create: `src/palette/types.ts`, `src/palette/catalog.ts`
- Test: `src/palette/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

`src/palette/catalog.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CATALOG, findComponent } from "./catalog";

describe("catalog", () => {
  it("has components across all categories with valid defaults", () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(35);
    for (const c of CATALOG) {
      expect(c.id).toBeTruthy();
      expect(c.defaults.serviceTimeMs).toBeGreaterThanOrEqual(0);
      expect(c.defaults.concurrency).toBeGreaterThan(0);
      expect(c.defaults.capacity).toBeGreaterThan(0);
      expect(c.defaults.failureRate).toBeGreaterThanOrEqual(0);
      expect(c.defaults.failureRate).toBeLessThanOrEqual(1);
    }
  });
  it("includes a source (client) and looks up by id", () => {
    expect(findComponent("client")?.isSource).toBe(true);
    expect(findComponent("sql-db")?.category).toBe("Storage");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/palette/catalog.test.ts`
Expected: FAIL — cannot find module `./catalog`.

- [ ] **Step 3: Write types**

`src/palette/types.ts`:
```ts
export type Category =
  | "Client" | "Traffic & Edge" | "Compute" | "Storage"
  | "Messaging" | "Observability" | "Network" | "AI & Agents" | "External";

export interface SimDefaults {
  serviceTimeMs: number;   // time to process one request
  concurrency: number;     // requests processed in parallel
  capacity: number;        // max queued before dropping
  failureRate: number;     // 0..1 probability a request fails at this node
}

export interface ComponentDef {
  id: string;
  name: string;
  category: Category;
  icon: string;            // emoji or short label for v1
  defaults: SimDefaults;
  isSource?: boolean;      // generates traffic
  isSink?: boolean;        // terminates a request (records latency)
}
```

- [ ] **Step 4: Write the catalog**

`src/palette/catalog.ts` — define `CATALOG: ComponentDef[]` covering the full taxonomy from the spec (Client, Mobile; DNS, CDN, Load Balancer, WAF, API Gateway, Ingress; App Server, Worker, Serverless, Auth Service, Search, Scheduler, Notifications, Analytics; SQL Database, NoSQL DB, Cache, Object Store, Data Warehouse, Vector DB; Message Queue, Pub/Sub, Event Stream, Kafka; Metrics, Logs, Tracing, Alerting, Health Check; VPC, Subnet, NAT Gateway, VPN, Service Mesh; LLM Gateway, Orchestrator, Tool Registry, Memory Fabric, Safety Mesh; 3rd Party API, Payment, Email). Give each realistic defaults (Cache: `serviceTimeMs:1, concurrency:200, capacity:5000`; SQL Database: `serviceTimeMs:8, concurrency:20, capacity:500`; App Server: `serviceTimeMs:5, concurrency:50, capacity:1000`, etc.). Mark `client` and `mobile` with `isSource:true, isSink:true`. Then:
```ts
export function findComponent(id: string): ComponentDef | undefined {
  return CATALOG.find((c) => c.id === id);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/palette/catalog.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/palette && git commit -m "feat: component palette catalog"
```

---

## Task 3: Engine types + traffic generation (TDD)

**Files:**
- Create: `src/sim/types.ts`, `src/sim/engine.ts`
- Test: `src/sim/engine.generation.test.ts`

- [ ] **Step 1: Write the failing test**

`src/sim/engine.generation.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim/engine.generation.test.ts`
Expected: FAIL — cannot find `./engine`.

- [ ] **Step 3: Write types**

`src/sim/types.ts`:
```ts
export interface SimNode {
  id: string;
  componentId: string;
  serviceTimeMs: number;
  concurrency: number;
  capacity: number;         // max queue length
  failureRate: number;
  isSource: boolean;
  isSink: boolean;
  genRatePerSec?: number;   // for sources
  // runtime:
  queue: RequestToken[];        // waiting
  inService: { token: RequestToken; remainingMs: number }[];
  // accumulators for utilization:
  busyMsThisWindow: number;
}

export interface SimEdge { id: string; source: string; target: string; }

export interface RequestToken {
  id: number;
  bornAtMs: number;         // sim time created
  latencyMs: number;        // accumulated
  failed: boolean;
}

export interface Metrics {
  completed: number;
  dropped: number;
  failed: number;
  latencySamples: number[]; // rolling window of completed end-to-end latencies
  throughputWindow: number[]; // completions per sub-step in the rolling window
  simTimeMs: number;
}

export interface SimState {
  nodes: Record<string, SimNode>;
  order: string[];
  edges: SimEdge[];
  outgoing: Record<string, SimEdge[]>;
  metrics: Metrics;
  nextTokenId: number;
  genCarry: Record<string, number>; // fractional request accumulator per source
}

export interface RunParams { speed: number; traffic: number; }
```

- [ ] **Step 4: Write minimal engine (generation + pass-through only)**

`src/sim/engine.ts`:
```ts
import { SimState, SimNode, SimEdge, RunParams, RequestToken } from "./types";

interface NodeInit {
  id: string; componentId: string; serviceTimeMs: number; concurrency: number;
  capacity: number; failureRate: number; isSource: boolean; isSink: boolean;
  genRatePerSec?: number;
}
interface StateInit { nodes: NodeInit[]; edges: SimEdge[]; }

export function createSimState(init: StateInit): SimState {
  const nodes: Record<string, SimNode> = {};
  const genCarry: Record<string, number> = {};
  for (const n of init.nodes) {
    nodes[n.id] = { ...n, queue: [], inService: [], busyMsThisWindow: 0 };
    if (n.isSource) genCarry[n.id] = 0;
  }
  const outgoing: Record<string, SimEdge[]> = {};
  for (const e of init.edges) (outgoing[e.source] ??= []).push(e);
  return {
    nodes, order: init.nodes.map((n) => n.id), edges: init.edges, outgoing,
    metrics: { completed: 0, dropped: 0, failed: 0, latencySamples: [], throughputWindow: [], simTimeMs: 0 },
    nextTokenId: 1, genCarry,
  };
}

const SUBSTEP_MS = 50;

export function step(state: SimState, dtMs: number, params: RunParams): SimState {
  const scaled = dtMs * params.speed;
  let remaining = scaled;
  while (remaining > 0) {
    const sub = Math.min(SUBSTEP_MS, remaining);
    subStep(state, sub, params);
    remaining -= sub;
  }
  return state;
}

function subStep(state: SimState, dtMs: number, params: RunParams) {
  state.metrics.simTimeMs += dtMs;
  // 1. generate at sources
  for (const id of state.order) {
    const n = state.nodes[id];
    if (!n.isSource || !n.genRatePerSec) continue;
    state.genCarry[id] += (n.genRatePerSec * params.traffic * dtMs) / 1000;
    while (state.genCarry[id] >= 1) {
      state.genCarry[id] -= 1;
      const token: RequestToken = { id: state.nextTokenId++, bornAtMs: state.metrics.simTimeMs, latencyMs: 0, failed: false };
      routeToken(state, id, token);
    }
  }
  // Task 4 adds node service; for now move queued tokens straight through sinks.
  drainSinks(state);
}

function drainSinks(state: SimState) {
  for (const id of state.order) {
    const n = state.nodes[id];
    if (!n.isSink) continue;
    for (const token of n.queue.splice(0)) {
      state.metrics.completed += 1;
      state.metrics.latencySamples.push(token.latencyMs);
    }
  }
}

export function routeToken(state: SimState, fromId: string, token: RequestToken) {
  const edges = state.outgoing[fromId];
  if (!edges || edges.length === 0) {
    // terminal but not sink: complete here
    const n = state.nodes[fromId];
    if (n.isSink) return; // sink handled in drain
    state.metrics.completed += 1;
    state.metrics.latencySamples.push(token.latencyMs);
    return;
  }
  // round-robin fan to first edge for v1 generation test
  const target = state.nodes[edges[0].target];
  enqueue(state, target, token);
}

export function enqueue(state: SimState, node: SimNode, token: RequestToken) {
  if (node.queue.length >= node.capacity) { state.metrics.dropped += 1; return; }
  node.queue.push(token);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/sim/engine.generation.test.ts`
Expected: PASS (completed 90–110, dropped 0).

- [ ] **Step 6: Commit**

```bash
git add src/sim && git commit -m "feat: sim engine traffic generation + routing skeleton"
```

---

## Task 4: Node service, queueing, and drops (TDD)

**Files:**
- Modify: `src/sim/engine.ts`
- Test: `src/sim/engine.service.test.ts`

- [ ] **Step 1: Write the failing test**

`src/sim/engine.service.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createSimState, step } from "./engine";

// A node with concurrency 1, serviceTime 10ms, capacity 2, fed 100 req/s.
// It can serve ~100 req/s max (1 in-flight / 10ms). Fed at 100/s it saturates
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim/engine.service.test.ts`
Expected: FAIL — db has no service logic, so nothing is dropped/served correctly.

- [ ] **Step 3: Add service processing to `subStep`**

In `src/sim/engine.ts`, replace the "Task 4 adds node service" comment and `drainSinks(state)` call with real per-node processing, inserted BEFORE generation-completed tokens are drained:
```ts
  // 2. advance in-service work and admit from queue for every non-sink node
  for (const id of state.order) {
    const n = state.nodes[id];
    if (n.isSource && !state.outgoing[id]) continue;
    // advance in-service
    const stillBusy: typeof n.inService = [];
    for (const item of n.inService) {
      item.remainingMs -= dtMs;
      if (item.remainingMs <= 0) {
        item.token.latencyMs += n.serviceTimeMs;
        if (Math.random() < n.failureRate) { item.token.failed = true; state.metrics.failed += 1; }
        routeToken(state, id, item.token);
      } else stillBusy.push(item);
    }
    n.inService = stillBusy;
    n.busyMsThisWindow += n.inService.length * dtMs;
    // admit from queue up to concurrency
    while (n.inService.length < n.concurrency && n.queue.length > 0) {
      const token = n.queue.shift()!;
      if (n.serviceTimeMs <= 0) { routeToken(state, id, token); }
      else n.inService.push({ token, remainingMs: n.serviceTimeMs });
    }
  }
  // 3. sinks record completion
  drainSinks(state);
```
Note: sinks have `serviceTimeMs 0`; keep `drainSinks` for tokens routed into a sink's queue. Ensure `routeToken` into a sink pushes to its queue (already does via `enqueue`), then `drainSinks` records them.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sim/engine.service.test.ts`
Expected: PASS.
Run: `npx vitest run src/sim/engine.generation.test.ts`
Expected: still PASS (no regression).

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/sim/engine.service.test.ts && git commit -m "feat: node service, queueing, and capacity drops"
```

---

## Task 5: Multi-hop latency accumulation (TDD)

**Files:**
- Test: `src/sim/engine.latency.test.ts`

- [ ] **Step 1: Write the failing test**

`src/sim/engine.latency.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it passes (or fix)**

Run: `npx vitest run src/sim/engine.latency.test.ts`
Expected: PASS given Task 4's `latencyMs += serviceTimeMs`. If it fails because sinks don't accumulate their own 0ms, that's fine. Fix only if avg is outside range.

- [ ] **Step 3: Commit**

```bash
git add src/sim/engine.latency.test.ts && git commit -m "test: multi-hop latency accumulation"
```

---

## Task 6: Metrics aggregation — percentiles, throughput, drop rate (TDD)

**Files:**
- Create: `src/sim/metrics.ts`
- Test: `src/sim/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

`src/sim/metrics.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim/metrics.test.ts`
Expected: FAIL — no module.

- [ ] **Step 3: Implement metrics**

`src/sim/metrics.ts`:
```ts
import { Metrics } from "./types";

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const xs = [...sorted].sort((a, b) => a - b);
  const idx = Math.min(xs.length - 1, Math.floor((p / 100) * xs.length));
  return xs[idx];
}

export interface MetricSummary {
  completed: number; dropped: number; failed: number;
  dropRate: number; p50: number; p95: number; p99: number;
}

export function summarize(m: Metrics): MetricSummary {
  const total = m.completed + m.dropped;
  return {
    completed: m.completed, dropped: m.dropped, failed: m.failed,
    dropRate: total === 0 ? 0 : m.dropped / total,
    p50: percentile(m.latencySamples, 50),
    p95: percentile(m.latencySamples, 95),
    p99: percentile(m.latencySamples, 99),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sim/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/metrics.ts src/sim/metrics.test.ts && git commit -m "feat: metrics percentiles + summary"
```

---

## Task 7: Chaos modifiers (TDD)

**Files:**
- Create: `src/sim/chaos.ts`
- Test: `src/sim/chaos.test.ts`

- [ ] **Step 1: Write the failing test**

`src/sim/chaos.test.ts`:
```ts
import { it, expect } from "vitest";
import { applyChaos, ChaosKind } from "./chaos";
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/sim/chaos.test.ts`
Expected: FAIL — no module.

- [ ] **Step 3: Implement chaos**

`src/sim/chaos.ts`:
```ts
import { SimState } from "./types";

export type ChaosKind = "latency-spike" | "crash" | "slowdown" | "recover";
export interface ChaosEvent { kind: ChaosKind; nodeId: string; factor?: number; }

// store originals so recover can restore
const originals = new WeakMap<SimState, Record<string, { serviceTimeMs: number; capacity: number }>>();

function remember(state: SimState, id: string) {
  let map = originals.get(state);
  if (!map) { map = {}; originals.set(state, map); }
  if (!map[id]) map[id] = { serviceTimeMs: state.nodes[id].serviceTimeMs, capacity: state.nodes[id].capacity };
}

export function applyChaos(state: SimState, ev: ChaosEvent) {
  const n = state.nodes[ev.nodeId];
  if (!n) return;
  if (ev.kind === "recover") {
    const saved = originals.get(state)?.[ev.nodeId];
    if (saved) { n.serviceTimeMs = saved.serviceTimeMs; n.capacity = saved.capacity; }
    return;
  }
  remember(state, ev.nodeId);
  if (ev.kind === "latency-spike") n.serviceTimeMs *= ev.factor ?? 5;
  else if (ev.kind === "slowdown") n.serviceTimeMs *= ev.factor ?? 2;
  else if (ev.kind === "crash") n.capacity = 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/sim/chaos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/chaos.ts src/sim/chaos.test.ts && git commit -m "feat: chaos modifiers with recover"
```

---

## Task 8: Zustand stores

**Files:**
- Create: `src/store/designStore.ts`, `src/store/simStore.ts`

- [ ] **Step 1: Design store**

`src/store/designStore.ts`: Zustand store holding React Flow `nodes` and `edges`, `selectedNodeId`, and actions: `addNode(componentId, position)`, `updateNodeParams(id, partial)`, `onNodesChange`, `onEdgesChange`, `onConnect`, `setSelected(id)`, `loadDesign({nodes,edges})`, `clear()`. Node `data` carries `{ componentId, params: SimDefaults, label, utilization }`.

- [ ] **Step 2: Sim store**

`src/store/simStore.ts`: Zustand store holding `running: boolean`, `speed: number`, `traffic: number`, `summary: MetricSummary | null`, `history: {t:number,p95:number,p99:number,throughput:number,dropRate:number}[]`, and actions `start/pause/step/reset`, `setSpeed`, `setTraffic`, `pushSnapshot(summary, perNodeUtil)`, `triggerChaos(ev)`. The runner (Task 9) writes here.

- [ ] **Step 3: Build check + commit**

Run: `npm run build`
Expected: compiles.
```bash
git add src/store && git commit -m "feat: zustand design + sim stores"
```

---

## Task 9: RAF runner wiring engine → stores

**Files:**
- Create: `src/sim/runner.ts`

- [ ] **Step 1: Implement runner**

`src/sim/runner.ts`: a `SimRunner` class that, on `start()`, builds a `SimState` from the current design store (map React Flow nodes/edges → engine `NodeInit`/`SimEdge`, reading `genRatePerSec` from source nodes' params), then runs a `requestAnimationFrame` loop. Each frame: compute `dtMs` from timestamps (clamp to 100ms), call `step(state, dtMs, {speed, traffic})`, every ~200ms call `summarize` + compute per-node utilization (`busyMsThisWindow / (concurrency * windowMs)`), push a snapshot to the sim store and write utilization back onto design-store nodes. `step()` (single frame advance) supports pause+step. `stop()` cancels the frame. Rolling windows: cap `latencySamples` length to last 2000; reset `busyMsThisWindow` each snapshot.

- [ ] **Step 2: Build check + commit**

Run: `npm run build`
```bash
git add src/sim/runner.ts && git commit -m "feat: RAF runner bridging engine and stores"
```

---

## Task 10: React Flow canvas + custom node + drag-from-palette

**Files:**
- Create: `src/canvas/Canvas.tsx`, `src/canvas/SystemNode.tsx`, `src/canvas/dnd.ts`, `src/ui/Palette.tsx`

- [ ] **Step 1: Custom node**

`src/canvas/SystemNode.tsx`: React Flow custom node showing icon + name, with `Handle` (source/target) on left/right. Background color interpolates green→amber→red by `data.utilization` (0→1); if capacity is 0 (crashed) show a red border. Memoized.

- [ ] **Step 2: Canvas**

`src/canvas/Canvas.tsx`: `<ReactFlow>` wired to design store (`nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`), `nodeTypes={{ system: SystemNode }}`, `onNodeClick` sets selection, `onDrop`/`onDragOver` (from `dnd.ts`) add a node at the drop position from the dragged `componentId`. Include `<Background/>`, `<Controls/>`, `<MiniMap/>`.

- [ ] **Step 3: Palette**

`src/ui/Palette.tsx`: render `CATALOG` grouped by category into collapsible sections; each item `draggable`, `onDragStart` sets `dataTransfer` payload `componentId` (via `dnd.ts` helper).

- [ ] **Step 4: Manual verify + commit**

Run: `npm run dev`, drag a few components onto the canvas, connect them.
Expected: nodes appear and connect.
```bash
git add src/canvas src/ui/Palette.tsx && git commit -m "feat: canvas, custom node, drag-from-palette"
```

---

## Task 11: Inspector panel

**Files:**
- Create: `src/ui/Inspector.tsx`

- [ ] **Step 1: Implement**

`src/ui/Inspector.tsx`: when a node is selected, show numeric inputs for `serviceTimeMs`, `concurrency`, `capacity`, `failureRate`, and (for sources) `genRatePerSec`; changes call `updateNodeParams`. Show live per-node stats (queue depth, utilization) during a run.

- [ ] **Step 2: Commit**

```bash
git add src/ui/Inspector.tsx && git commit -m "feat: node inspector"
```

---

## Task 12: Control bar (run controls)

**Files:**
- Create: `src/ui/ControlBar.tsx`

- [ ] **Step 1: Implement**

`src/ui/ControlBar.tsx`: Start/Pause toggle + Step button (wired to the runner + sim store), Speed segmented control (0/1/2.5/5×), Traffic segmented control (0/1/2.5/5×), plus slots for Presets dropdown (Task 15) and Save/Load/Export (Task 16) and ChaosControls (Task 14).

- [ ] **Step 2: Commit**

```bash
git add src/ui/ControlBar.tsx && git commit -m "feat: run control bar"
```

---

## Task 13: Metrics panel + Recharts

**Files:**
- Create: `src/ui/MetricsPanel.tsx`

- [ ] **Step 1: Implement**

`src/ui/MetricsPanel.tsx`: show current numbers (throughput, p50/p95/p99 latency, drop rate, completed/dropped) from `simStore.summary`, plus two Recharts `LineChart`s over `simStore.history`: one for p95/p99 latency, one for throughput + drop rate. Cap history to last 120 points.

- [ ] **Step 2: Commit**

```bash
git add src/ui/MetricsPanel.tsx && git commit -m "feat: metrics panel with live charts"
```

---

## Task 14: Chaos controls UI

**Files:**
- Create: `src/ui/ChaosControls.tsx`

- [ ] **Step 1: Implement**

`src/ui/ChaosControls.tsx`: buttons for Latency spike ⚡, Traffic surge 🌪, Slowdown 🐌, Crash 💥, and Recover, each acting on the currently selected node (traffic surge acts globally by bumping the sim-store traffic). Wire to `simStore.triggerChaos`, which forwards to the runner's live `SimState` via `applyChaos`.

- [ ] **Step 2: Commit**

```bash
git add src/ui/ChaosControls.tsx && git commit -m "feat: chaos controls UI"
```

---

## Task 15: Presets

**Files:**
- Create: `src/presets/index.ts`, `src/presets/url-shortener.json`, `src/presets/news-feed.json`, `src/presets/chat.json`

- [ ] **Step 1: Author presets**

Each JSON: `{ name, nodes: [...React Flow nodes with data.componentId+params+genRatePerSec], edges: [...] }`. Design three realistic small architectures (URL shortener: client→API GW→app→cache+SQL; news feed: client→LB→app→cache+NoSQL+fanout worker; chat: client→WS gateway→app→queue→NoSQL). `src/presets/index.ts` exports the registry `[{id,name,data}]`.

- [ ] **Step 2: Wire Presets dropdown**

In `ControlBar`, add a dropdown listing presets; selecting one calls `designStore.loadDesign(preset.data)`.

- [ ] **Step 3: Manual verify + commit**

Load each preset and run it.
```bash
git add src/presets src/ui/ControlBar.tsx && git commit -m "feat: starter architecture presets"
```

---

## Task 16: Persistence (localStorage + export/import)

**Files:**
- Create: `src/persistence/storage.ts`
- Test: `src/persistence/storage.test.ts`

- [ ] **Step 1: Write the failing test**

`src/persistence/storage.test.ts`:
```ts
import { it, expect, beforeEach } from "vitest";
import { saveDesign, listDesigns, loadDesign, exportJSON, importJSON } from "./storage";

beforeEach(() => localStorage.clear());

it("saves, lists, and loads a named design", () => {
  const design = { nodes: [{ id: "n1" }], edges: [] } as any;
  saveDesign("my-app", design);
  expect(listDesigns()).toContain("my-app");
  expect(loadDesign("my-app")).toEqual(design);
});

it("round-trips through export/import JSON", () => {
  const design = { nodes: [{ id: "n1" }], edges: [] } as any;
  const json = exportJSON(design);
  expect(importJSON(json)).toEqual(design);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/persistence/storage.test.ts`
Expected: FAIL — no module.

- [ ] **Step 3: Implement**

`src/persistence/storage.ts`: `saveDesign(name, design)`, `listDesigns()`, `loadDesign(name)`, `deleteDesign(name)` backed by a `sds:designs` localStorage key (JSON map), plus `autosave(design)` under `sds:autosave`, and `exportJSON(design)` / `importJSON(str)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/persistence/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire autosave + Save/Load/Export UI into ControlBar**

Debounced autosave on design changes; Save (prompt name), Load (list), Export (download blob), Import (file input).

- [ ] **Step 6: Commit**

```bash
git add src/persistence src/ui/ControlBar.tsx && git commit -m "feat: persistence, named designs, export/import"
```

---

## Task 17: Assemble App + final verification

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Compose layout**

`src/App.tsx`: three-column layout — `<Palette/>` (left), `<Canvas/>` (center) with `<ControlBar/>` on top, `<Inspector/>` + `<MetricsPanel/>` (right). Instantiate a single `SimRunner`; wire ControlBar/ChaosControls to it.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all engine/metrics/chaos/storage tests PASS.

- [ ] **Step 3: Manual end-to-end**

Run: `npm run dev`. Load the URL-shortener preset → Start → raise Traffic to 5× → watch a node redden and drop rate climb → Crash the cache → observe p99 spike → Recover.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx && git commit -m "feat: assemble app layout and wire runner"
```

---

## Self-Review notes (author)

- **Spec coverage:** stack (T1), full palette (T2), engine generation/service/queue/drops/latency (T3–T5), metrics p50/p95/p99+throughput+drops (T6), chaos incl. recover (T7), stores+runner (T8–T9), canvas+palette+DnD (T10), inspector (T11), controls incl. speed/traffic (T12), charts (T13), chaos UI (T14), presets (T15), persistence+export/import (T16), assembly (T17). All spec sections mapped.
- **Type consistency:** `SimNode`/`SimEdge`/`RequestToken`/`Metrics`/`SimState` defined in T3 and reused; `SimDefaults` from T2 reused as node `params`; `applyChaos(state, ChaosEvent)` signature stable across T7/T9/T14; `summarize(Metrics)→MetricSummary` used by T6/T9/T13.
- **Note for executor:** engine tests are the correctness gate — do not weaken assertions to make them pass; fix the model instead.
```
