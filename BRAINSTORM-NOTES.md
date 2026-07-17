# System Design Simulator — Brainstorm Notes (in progress)

Personal, local, offline tool for practicing system-design interviews.
Inspired by paperdraw.dev, minus the paywall (paperdraw limits 3 free sim runs/day).

## Decisions locked so far
- **Goal:** Simulation-first — the educational value is watching traffic flow through a
  design and seeing bottlenecks/backpressure under load. Drawing is the means, not the point.
- **Canvas base:** React Flow (recommended; tentatively accepted). Explicit nodes/edges map
  directly to the simulation graph. Nodes carry sim data (capacity, service time); edges are
  the request paths. Can revisit vs Excalidraw later.
- **Simulation depth:** Queueing model. Each node has a service time + concurrency/capacity
  and a queue; requests flow as tokens; overflow queues then drops; latency accumulates along
  the path. Surfaces real bottlenecks & backpressure. (Not just flow animation; not full
  discrete-event sim — those are the simpler/heavier alternatives.)
- **Core v1 (assumed in):** React Flow canvas + component palette + queueing simulation +
  live latency/throughput/drop metrics + local save (localStorage/IndexedDB).

## OPEN — pick up here tomorrow
Which extras belong in v1 (multi-select):
- Chaos controls (inject latency spikes, traffic surges, node crashes mid-sim)
- Live metrics charts (p95/p99 latency, throughput, drops over time)
- Starter presets (URL shortener, news feed, chat — load and stress-test)
- Full component taxonomy (~40 components incl. AI/agents) vs focused ~15-component v1 set

## Remaining brainstorming steps after that
1. Propose 2-3 approaches + recommendation
2. Present design sections, get approval
3. Write spec to docs/superpowers/specs/YYYY-MM-DD-sysdesign-simulator-design.md
4. Spec self-review + user review
5. Writing-plans skill -> implementation

## Paperdraw architecture (reverse-engineered, for reference)
- Vite + React SPA; **Excalidraw** embedded as the canvas (355 refs in bundle)
- mermaid-to-excalidraw for diagram import
- PWA: Workbox service worker + manifest (installable, offline)
- Persistence: localStorage (61x) + IndexedDB (24x), fully client-side
- Sim engine: runs in a Web Worker + requestAnimationFrame; `latency` appears 272x
- Metrics: throughput, p95/p99 latency, drops, success rate
- Chaos modes: latency spike, traffic surge, slowdown, connection drop, crash, degradation
- Backend (the ONLY server dependency): Supabase (auth + the 3-runs/day quota),
  Stripe + LemonSqueezy for "Paperdraw+". A local clone drops this layer entirely.
- Component palette groups: Client/Mobile; Traffic&Edge (DNS/CDN/LB/WAF/API GW/Ingress);
  Compute (App Server/Worker/Serverless/Auth/Search/Scheduler/Notifications/Analytics);
  Storage (SQL/NoSQL/Cache/Object/Warehouse/Vector); Messaging (Queue/PubSub/Stream/Kafka);
  Observability (Metrics/Logs/Tracing/Alerting/Health); Network (VPC/Subnet/NAT/VPN/Mesh);
  AI&Agents (LLM Gateway/Orchestrator/Tool Registry/Memory Fabric/Safety Mesh); External.
