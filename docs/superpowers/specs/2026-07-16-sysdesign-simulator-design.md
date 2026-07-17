# System Design Simulator — Design Spec

**Date:** 2026-07-16
**Status:** Approved (design), pending spec review → implementation plan

## Purpose

A personal, local, offline tool for practicing system-design interviews. Inspired by
paperdraw.dev but with **no paywall, no accounts, no backend, and unlimited simulation runs**
(paperdraw caps 3 free runs/day via a Supabase-enforced quota).

Primary value is **simulation-first**: place system components on a canvas, connect them,
run traffic through the design, and watch latency / throughput / bottlenecks / backpressure
under load and injected chaos. Drawing is the means; the teachable lesson is the queueing
behavior.

### Non-goals (v1)
- Not a pixel-for-pixel Excalidraw-style hand-drawn clone (uses React Flow — cleaner diagram
  look, far better simulation fit). Replicates paperdraw's *functionality*, not its aesthetic.
- No collaboration, sharing, publishing, or cloud sync.
- No authentication or usage limits.

## Stack

- **Vite + React + TypeScript**
- **React Flow** — canvas (nodes/edges, pan/zoom/drag/connect out of the box)
- **Zustand** — app + simulation state
- **Recharts** — live metric time-series charts
- **Tailwind CSS** — styling
- **Vitest** — unit tests for the engine
- Persistence: **localStorage** (autosave + named designs) with JSON export/import.

## Project structure

```
src/
  palette/    # component catalog (pure data) + category grouping
  sim/        # simulation engine: framework-agnostic, unit-tested
  canvas/     # React Flow node/edge components, drag-from-palette
  ui/         # control bar, inspector, metrics panel, charts, chaos controls
  presets/    # starter architectures as JSON
  store/      # Zustand stores (design state, sim state)
```

## Domain model

- **Component (palette entry):** pure data.
  `{ id, name, category, icon, defaults: { serviceTimeMs, concurrency, capacity, failureRate } }`
  The full 40+ taxonomy is a config array — a large palette costs nothing at runtime.
- **Node (placed instance):** a component instance with per-node overridable params, editable
  via the inspector.
- **Edge:** a directed request path between nodes.
- **Source node:** generates traffic at a configurable rate (× the global Traffic multiplier).
- **Client/Sink node:** terminates a request so end-to-end latency can be recorded.

### Component taxonomy (full palette, from paperdraw)
- **Client:** Client, Mobile
- **Traffic & Edge:** DNS, CDN, Load Balancer, WAF, API Gateway, Ingress
- **Compute:** App Server, Worker, Serverless, Auth Service, Search, Scheduler,
  Notifications, Analytics
- **Storage:** SQL Database, NoSQL DB, Cache, Object Store, Data Warehouse, Vector DB
- **Messaging:** Message Queue, Pub/Sub, Event Stream, Kafka
- **Observability:** Metrics, Logs, Tracing, Alerting, Health Check
- **Network:** VPC, Subnet, NAT Gateway, VPN, Service Mesh
- **AI & Agents:** LLM Gateway, Orchestrator, Tool Registry, Memory Fabric, Safety Mesh
- **External:** 3rd Party API, Payment, Email

Each ships sensible default sim params (e.g. Cache: low service time, high concurrency;
SQL DB: higher service time, lower concurrency). Params are tunable per node.

## Simulation engine (fixed-timestep tick loop)

- Single `requestAnimationFrame` loop. Each frame advances simulation time by
  `realDelta × speed`, processed in fixed **50 ms sub-steps** for determinism.
- **Per sub-step, per node:**
  1. Admit queued requests into service up to `concurrency`.
  2. Advance in-service timers; on completion, emit request tokens onto outgoing edges
     (routing: round-robin / fan-out per edge config).
  3. Incoming requests beyond `capacity` (queue limit) are **dropped** (backpressure).
  4. Apply `failureRate` and any active chaos modifiers.
- Requests accumulate latency as they traverse; on reaching a Client/Sink, end-to-end
  latency is recorded.
- **Metrics (rolling window):** throughput (req/s), p50/p95/p99 end-to-end latency,
  drop rate, and per-node queue depth + utilization.
- Bottleneck nodes are visually highlighted on the canvas (color scales with utilization;
  saturated/dropping nodes redden).
- The engine is a **plain TypeScript module** (`step(state) => state` plus metric emitters),
  fully unit-testable with no React dependency.

## Chaos controls

Mid-simulation toggles that mutate live node/edge params, with a **Recover** to revert:
- **Latency spike** — multiply a node's service time by N.
- **Traffic surge** — burst the source generation rate.
- **Node crash** — set a node's capacity to 0 (all requests routed through it drop).
- **Slowdown / degradation** — gradual service-time increase.

p99 latency and drop rate react in real time so the user sees the design's failure modes.

## UI layout

- **Left:** palette, grouped and collapsible; drag components onto the canvas.
- **Center:** React Flow canvas; nodes colored by live utilization during a run.
- **Right:** inspector (selected node's params) + metrics panel (current numbers + Recharts
  time-series for throughput, p95/p99 latency, drops).
- **Top bar:** Start / Pause / Step, Speed (0 / 1 / 2.5 / 5×), Traffic multiplier (0 / 1 /
  2.5 / 5×), Chaos buttons, Presets dropdown, Save / Load / Export.

## Presets

Three starter architectures shipped as JSON, loadable and immediately runnable:
URL shortener, news feed, chat/messaging.

## Persistence

- Autosave current design to localStorage on change (debounced).
- Named "My Designs" list (save/load/delete).
- JSON export/import for manual backup and sharing files by hand.

## Testing

- **Vitest** unit tests are the correctness gate for the engine (TDD):
  - Conservation: every request either completes or is counted as dropped (none vanish).
  - Queue overflow beyond capacity produces drops.
  - Latency accumulates correctly along a multi-hop path.
  - A capacity-constrained node is correctly identified as the bottleneck (highest
    utilization / queue depth).
  - Chaos modifiers change metrics in the expected direction.
- UI verified manually in-browser (drag, connect, run, observe).

## Open questions / deferred to v2

- Web Worker execution (approach B) if very large graphs ever stutter — model is unchanged,
  only the host moves off-thread.
- Discrete-event engine (approach C) for higher timing accuracy.
- Full component taxonomy is in v1; retries / timeouts / connection pools deferred.
