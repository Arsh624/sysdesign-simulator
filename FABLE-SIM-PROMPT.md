# Super-Prompt: Rebuild the simulation engine for real-systems fidelity

> Paste everything below into Fable 5 (claude-fable-5), running in this repo.

---

You are upgrading the **simulation engine** of an existing local "system-design interview
practice" web app (a paperdraw.dev-style tool). The UI, canvas, animation, stores, and build
are DONE and good. The problem is ONLY the simulation math: it is too simplistic and does not
behave like a real distributed system. Your job is to replace the engine's model with a
realistic one, while keeping every existing integration point working.

## Repo & stack
- Path: `C:\Users\archi\OneDrive\Desktop\Projects\simulation` (Windows; Git Bash available).
- React 19 + Vite 8 + TypeScript + Tailwind v4 + zustand v5 + @xyflow/react v12 + recharts + vitest.
- `verbatimModuleSyntax` is ON → type-only imports MUST use `import type`.
- Verify with `npx tsc --noEmit -p .`, `npm run build`, `npm run test`. Never claim done until all pass.
- Reference doc already in repo: `PAPERDRAW-OBSERVATIONS.md` (my notes from watching the real app).

## Current architecture (do NOT rewrite the UI — only the engine + what it feeds)
- `src/sim/engine.ts` — pure tick loop. `createSimState(init)`, `step(state, dtMs, {speed, traffic})`.
  Internally sub-steps at 1ms. `subStep` does: (1) generate at sources by `genRatePerSec*traffic`,
  (2) per-node service loop (advance in-service, admit from queue up to `concurrency`, on finish
  `routeToken`), (3) `drainSinks`. `routeToken` now FANS OUT to every outgoing edge (clones token).
  `enqueue` drops when `queue.length >= capacity`. Emits `flowEvents`/`dropEvents` for animation.
- `src/sim/types.ts` — `SimNode` (runtime: queue, inService[{token,remainingMs}], busyMsThisWindow,
  completedCount, latencyWindow), `SimEdge`, `RequestToken {id,bornAtMs,latencyMs,failed,nodeEnqueuedAtMs?}`,
  `Metrics {completed,dropped,failed,latencySamples,throughputWindow,simTimeMs}`, `SimState`,
  `FlowEvent`, `DropEvent`, `RunParams {speed,traffic}`.
- `src/sim/metrics.ts` — `percentile(arr,p)`, `summarize(metrics): MetricSummary`.
- `src/sim/runner.ts` — `SimRunner` singleton drives a requestAnimationFrame loop, builds SimState
  from the design store, calls `step`, and every ~200ms `snapshot()` writes per-node runtime
  `{utilization, queueDepth, crashed, rps, p95}` into the design store and a global `MetricSummary`
  + `HistoryPoint` into the sim store. Has `takeFlowEvents()/takeDropEvents()` for the animation.
- `src/palette/catalog.ts` — 44 components, each `ComponentDef` with
  `defaults: { serviceTimeMs, concurrency, capacity, failureRate }`, plus `isSource`/`isSink`.
- Stores: `src/store/designStore.ts` (React Flow nodes; `SystemNodeData` has params + runtime fields
  utilization/queueDepth/crashed/rps/p95), `src/store/simStore.ts` (running/speed/traffic/summary/history).
- UI reads runtime fields to render node labels ("Load %", "N rps · P ms p95", queue) and a top HUD
  (throughput, p95, drop rate, availability-in-nines, bottleneck). `FlowOverlay.tsx` animates packets;
  red edges appear when a target node is crashed or utilization ≥ 0.85. Do not break these consumers.

## What is WRONG with the current model (fix all of these)
1. **No dependency coupling.** Each node is an independent M/M/c queue. A node finishes its own
   service and forgets the request. In reality a synchronous caller (App Server) holds a worker/
   thread for the ENTIRE downstream call chain. Because of this, only the single lowest-capacity
   node (the SQL DB) ever shows load; the App Server sits near 0% even when it should be the
   bottleneck. Real result we want: on `Client→LB→App Server→{Cache, SQL}` under load, the **App
   Server saturates first** (it blocks threads waiting on Cache+SQL), exactly like the real app
   (App 85% + failing while SQL ~33%).
2. **Deterministic latency.** Fixed `serviceTimeMs` → p50 = p95 = p99, no tail. Real systems have
   variance; tail latency (p99) must blow up as utilization rises. This is the user's "not
   randomised" complaint.
3. **No backpressure propagation / cascades.** A slow or failing downstream should raise the
   caller's effective service time, queue, error rate, and eventually trip protection — cascading
   failure upstream. Currently failures are just a static per-node coin flip.
4. **No resource realism.** No thread pools, connection pools, CPU saturation curves, cache
   hit/miss, retries, timeouts, or circuit breakers — all of which paperdraw models and surfaces.
5. **Utilization is trivial** (busy-ms / concurrency), so it never reflects real congestion.

## Target behaviour (match paperdraw's realism — see PAPERDRAW-OBSERVATIONS.md)
Build a model where, for a typical `Client→LB→App Server→{Cache, SQL}` design:
- At low load: everything green, p50≈p95, low utilization.
- Raising Traffic: multiple nodes light up with DIFFERENT utilizations (LB moderate, **App Server
  highest** due to downstream wait, Cache low, SQL moderate) — NOT just one node.
- Near saturation: p95/p99 diverge sharply from p50 (fat tail), queues grow, effective throughput
  plateaus then drops, error rate climbs, edges go red, drops occur.
- Overload/chaos on one node **cascades**: upstream callers' latency + error rate rise, a circuit
  breaker can trip, and the system enters a "runaway" regime, then recovers when load drops.

### Required engine capabilities
1. **Synchronous dependency model (the key fix).** A request entering a node occupies one of its
   `concurrency` workers/threads for: its own local service time PLUS the time spent waiting on all
   of its downstream calls (fan-out to children, wait for them to return, then the worker frees).
   Model requests as they traverse and RETURN (a proper request→response round trip): the response
   should flow back to the client and record true end-to-end latency (also fixes the user's "client
   never gets it back"). Emit flow events for BOTH directions so the animation shows request and
   response packets (respect the existing `FlowEvent` shape / `takeFlowEvents` API).
2. **Stochastic service times.** Draw each local service time from a distribution around the
   component's base (e.g. log-normal or exponential-ish) using a SEEDED PRNG so tests stay
   deterministic. Under queueing this must naturally produce p50 < p95 < p99 with a growing tail.
   NOTE: `Math.random()`/`Date.now()` are unavailable in some contexts — use an injectable seeded RNG.
3. **Queueing + finite pools + backpressure.** Bounded queue per node; when the worker pool AND
   queue are full, reject/drop (or apply timeout). Utilization = pool occupancy over the window.
4. **Dynamic errors + cascades + circuit breaker.** Downstream latency/errors raise a caller's
   effective service time and error rate; a per-node circuit breaker (closed/open/half-open) trips
   on sustained downstream failure, shedding load and surfacing as `cb: open`. Overload → cascading
   error propagation upstream (a "runaway" regime), with recovery when pressure drops.
5. **Realistic per-component profiles.** Extend the catalog (or a parallel profile table) so each
   component type has sensible: base service time + variance, worker/thread concurrency, connection
   pool limit, queue capacity, base failure rate, and role hints (compute vs cache vs datastore vs
   edge). Tune so compute nodes bottleneck around realistic rps and DBs around theirs — so load
   distributes across the graph rather than pinning one node. Keep it data-driven and documented.
6. **Richer telemetry per node** (feed the existing store fields, extend as needed): rps, p50/p95/p99,
   error %, utilization/cpu, queue depth, circuit-breaker state, pool usage, "slowness" multiplier.
   Extend `SystemNodeData` + `updateNodeRuntime` + `SystemNode.tsx` label to show the important ones
   (at least rps, p95, err%, cb state) cleanly without layout jumps.
7. **Global regime + bottleneck** in the HUD: throughput, global p95/p99, availability, drop rate,
   bottleneck node, and a regime indicator (STEADY / SATURATED / RUNAWAY). Reuse/extend the HUD.

## Constraints & integration (do not break these)
- Keep it a pure, framework-agnostic engine (no React imports in `src/sim/*`). The `runner.ts` RAF
  loop, `designStore`/`simStore` shapes, `FlowOverlay` animation contract (`takeFlowEvents/
  takeDropEvents`, `FlowEvent{id,sourceId,targetId,bornAtMs}`, `DropEvent{id,nodeId,atMs}`), and the
  ControlBar (Start/Pause/Step/Reset, Speed & Traffic multipliers, Chaos buttons) must keep working.
- Keep `createSimState`/`step` as the entry points the runner calls (you may change their internals
  and the `SimState`/`SimNode` shapes, but update all call sites + the store build accordingly).
- Performance: must stay smooth at a few thousand rps with the RAF loop (cap animation particles as
  the overlay already does; keep per-frame work bounded; use fixed sub-steps).
- Determinism for tests: seeded RNG injected via state so vitest tests are reproducible.
- TESTS: update the existing vitest suite to the new model and ADD tests for the new behaviour:
  (a) conservation (every request completes, drops, or errors — none vanish/double-count),
  (b) round-trip latency accumulates over the full path and returns to the client,
  (c) downstream slowdown raises the CALLER's utilization/latency (coupling),
  (d) p95/p99 exceed p50 under load (tail),
  (e) overloading a node cascades error rate upstream and can trip a breaker,
  (f) on `Client→LB→App→{Cache,SQL}`, App Server utilization > SQL utilization at a load where the
      App is the bottleneck. All tests + `tsc` + `build` must pass.

## Working method (IMPORTANT)
- Work on a branch: `git checkout -b feat/realistic-engine`.
- Start by writing/adjusting tests that encode the target behaviour (TDD), then implement.
- Commit in logical chunks with clear messages; keep the app building at each commit.
- Do NOT touch unrelated UI/styling. Keep files focused and well-named. Prefer clear, documented
  code over cleverness — this is an educational tool; the model should be explainable.
- When done: summarize the new model in a short `docs` note, run the full suite + build, and report
  the before/after utilization on the `Client→LB→App→{Cache,SQL}` scenario proving the App Server
  now bottlenecks and latencies have a realistic tail.

Deliverable: a simulation that behaves like a real distributed system — coupled dependencies,
request/response round trips, stochastic tail latency, backpressure, circuit breakers, cascading
failure, and load that spreads realistically across the graph — wired into the existing UI/animation.
