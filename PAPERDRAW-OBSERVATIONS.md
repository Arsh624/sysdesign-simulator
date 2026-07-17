# Paperdraw.dev — Live Observation Notes (from 1 signed-in simulation run, 2026-07-16)

Studied the real product running a simulation, to replicate accurately. Diagram used:
Client → Load Balancer → App Server → {Cache, SQL Database} (fan-out branch).

## 1. THE PACKET ANIMATION (the key thing to replicate)
- Packets are NOT round glowing dots. They are **short rounded "pills"/dashes** riding ON TOP
  of the connection wire — like segments of an animated dashed line flowing through a pipe.
- **Healthy edge:** base wire is BLUE; pills are a slightly darker/brighter blue, flowing from
  source → target continuously.
- **Failing edge:** the entire wire turns **solid RED**, the pills on it are RED, and a small
  red **"error" badge/label** sits on the wire. The failing node gets a ✦ marker next to its name.
- **Density / spacing ∝ the request rate (rps) on that specific edge** — busy edges show a dense
  stream of pills; quiet edges show sparse pills. Pills bunch/cluster under load (uneven spacing).
- Motion speed scales with the Speed control. Direction always source→target along the wire path
  (follows the orthogonal/curved routing of the edge).
- Fan-out: at a branching node, each outgoing edge carries its own independent pill stream,
  colored by that downstream edge's health (Cache edge red while it cascades, etc.).

## 2. PER-NODE LIVE TELEMETRY (label under each node)
Each node shows "Load : X%" plus a stats block that updates live:
  rps (throughput) | arr (arrival rate) | p95 | p50 latency | err % | cpu % |
  cb: closed/open (circuit-breaker state) | queue: N (backlog depth) | slowness: Nx multiplier
Node fill tint reflects load/health (green healthy → red hot). Bottleneck node highlighted.

## 3. PER-NODE LIVE DIAGNOSTIC ANALYSIS (SRE-style reasoning text beside each node)
A numbered, live-updating analysis, e.g. App Server:
  "1. Failing 79% of requests  2. Error rate rising: 61%→72%→79%  3. Downstream wait cutting
   capacity: Cache reducing effective throughput 2000→102 req/s  4. GC consuming ~13% CPU (jvm)
   5. 82% utilized — CPU is the constraint  6. Utilization trending up 79%→80%→82%
   7. Queue at 3731 — 3.0s of backlog  8. Mean 2999ms — P99 est 8107ms  9. GC=g1 (50ms pause),
   heap=4096MB  10. spring-boot http2 — 1024 max connect  11. Failure cascading to: <node>"
Cache/DB have their own (hit rate ~65%, 8192MB capacity, eviction lru, kv 1 disk op / shared_buffers
256MB, WAL replica, connection pool, headroom-before-saturation, etc.). Very detailed & realistic.

## 4. TOP HUD BAR (global, live)
RPS (total) | P95 (global) | AVAIL % (+ "N fail") | BURN (error-budget burn rate) |
BOTTLENECK <node> X% | REGIME <STEADY/RUNAWAY/...> | CASCADE "Cascade in progress: <root node>
(root, X% error rate)". Availability oscillates (saw 100% ↔ 13–50%) as the App Server cascades
into overload then recovers — models cascading failure + recovery cycles + circuit breakers.

## 5. DESIGN INSIGHTS PANEL (right side, toggled by INSIGHTS tab)
- LATENCY WATERFALL: per-hop contribution with bars + total (e.g. Client 0ms, LB 1ms,
  App Server 47ms, Cache 32ms = 80ms total; ballooned to 616ms under runaway).
- CALCULATED AVAILABILITY: % with "nines" wording ("two nines", "below SLA") + a range bar.
- SINGLE POINTS OF FAILURE: count + list w/ tags (Load Balancer=gateway, App Server=compute, Cache=cache).
- BOTTLENECK RANKING: nodes ranked by utilization with bars.
- REQUIREMENT COVERAGE: pass/✗ against targets — QPS (1.2K/2.8K target), p95 Latency (vs SLA),
  Availability (13%/100% target). This is the interview-grading layer.

## 6. CONTROLS
- START/STOP SIMULATION (requires login; 3 free runs/day).
- Speed: 0x / 1x / 2.5x / 5x (slider).  Traffic: 0x / 1x / 2.5x / 5x (slider).
- CHAOS quick-bar: 7 icon buttons at the bottom.
- Log button (event log toggle), INSIGHTS tab, Publish (to community gallery).

## 7. CHAOS LIBRARY (right "Chaos" tab) — ~30 injectors across categories
- INFRASTRUCTURE FAILURES: Availability Zone, Data Center, Instance Crash, Instance Slow,
  Disk Failure, Disk Corruption, Storage IOPS, File System, VM CPU, Host Hardware.
- NETWORK CHAOS: Network Partition, Cross-Region Loss, Packet Loss, High Latency, Bandwidth
  Throttle, Connection Flap, Load Balancer, Backend Port, Health Check, TLS Certificate, DNS Resolution.
- APPLICATION-LEVEL CHAOS: Memory Leak, Out of Memory, Thread Pool, Deadlock, Cache Stampede, Error Storm.
- GLOBAL EVENTS: Traffic Surge.

## 8. COMPONENT PALETTE (Presets tab) — generic + vendor variants
Client (Client/Mobile/Web Browser); Traffic&Edge (DNS/CDN/LB/WAF/API Gateway/Ingress/Fastly/
Cloudflare); Compute (App Server/Worker/Serverless/Auth/Search/Scheduler/Notifications/Analytics/
Node.js/Python/Go/Cloud Function/Sidekiq/JWT Validator/Embedding Model/Temporal/Keycloak/Vault/
Spark/dbt); Storage (SQL/NoSQL/Cache/Object/Warehouse/Vector + MySQL/CockroachDB/DynamoDB/Memcached/
GCS/Pinecone/Weaviate/OpenSearch/InfluxDB/Neo4j/ClickHouse/Cassandra/ScyllaDB/Vitess/TimescaleDB/
Dragonfly/Qdrant/Milvus); Messaging (Queue/PubSub/Event Stream/Kafka/SQS/Redis PubSub/NATS/Redpanda);
Observability (Metrics/Logs/Tracing/Alerting/Health Check/Jaeger/Loki); Network (VPC/Subnet/NAT/VPN/
Service Mesh/Anycast LB/Kong/Nginx/HAProxy/Envoy/Firewall/Linkerd/Traefik/Consul); AI&Agents
(LLM Gateway/Orchestrator/Tool Registry/Memory Fabric/Safety Mesh); External (3rd Party API/Payment/
Email/Daily Batch/Cron Trigger/Webhook). Built on Excalidraw canvas.

## GAP vs OUR APP (what to build to match)
Our animation = plain glowing round dots that travel edge→edge. Paperdraw = flowing pill/dash
stream ON the wire, density ∝ per-edge rps, whole wire+pills turn red + "error" badge on failure,
✦ marker on failing node. Also paperdraw's sim is much deeper (circuit breakers, cascades, regimes,
GC/thread-pool/connection modeling, latency waterfall, availability nines, SPOF + requirement grading).
For OUR v2 animation specifically: switch dots→flowing dashed pills, tie per-edge density to that
edge's throughput, turn the wire itself red (not just dots) on drops/overload, add an "error" label,
and mark the bottleneck node.
