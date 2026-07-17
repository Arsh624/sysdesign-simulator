# How the simulation engine works

This is a plain-language guide to the call-based engine (`src/sim/engine.ts`),
for anyone using the tool who wants to understand what the numbers mean.

## The call tree

Every incoming request is a tree of `Call` objects, not a single token moving
along a pipe. When a request arrives at a node with outgoing edges, the engine
fans it out into one child call per edge, all in parallel, and the parent call
sits in a `"waiting"` phase until every child has returned (success or error).
Only when the last child settles does the parent bubble its result upward.
This means a single root request can spawn many calls across the diagram at
once, mirroring how a real request fans out to downstream services.

## Worker-held-while-waiting coupling

Each node has a fixed-size worker pool (`concurrency`). A call holds a worker
for its *entire* lifetime at that node: first while it's actively being
served locally (`"serving"`), then while it's blocked waiting on its
downstream children to answer (`"waiting"`). This is deliberate — it's what
makes a slow downstream dependency visibly starve an upstream node's worker
pool, exactly as happens in real systems (thread-pool exhaustion, connection
pool exhaustion, etc.). A node can show high utilization even though none of
its own local work is slow, purely because it's waiting on someone else.

## Lognormal service times

Local service time isn't a fixed number — each call samples a lognormal
duration: `serviceTimeMs * exp(variance * z)` where `z` is a standard normal
draw. This gives a realistic long right tail (most calls finish near the
mean, but a minority take much longer), and the `variance` (sigma) is tuned
per component category in `src/sim/profiles.ts` — datastores and external
APIs get more jitter than caches and edge components.

## Circuit breakers

Every node tracks a rolling window of its last ~25 outcomes. If the error
rate in that window crosses 50% (with a minimum sample size), the breaker
trips to `"open"`: subsequent calls fail fast without doing local work,
protecting the node (and its downstream dependencies) from pointless load.
After a cooldown, the breaker moves to `"half"` — the next call is a trial;
success closes the breaker again, failure reopens it.

## Drops and timeouts

- **Drop**: if a node's queue is full (or its capacity has been crashed to
  zero by chaos), an arriving call is rejected immediately and counted as a
  drop — it never gets a worker.
- **Timeout**: any call that has been alive since its root request began
  longer than the request timeout (5s) is forcibly failed, whether it's
  still queued or actively waiting on children. This bounds worst-case
  request latency and frees the worker holding it.

## The regime indicator

The HUD's REGIME stat is a simple traffic-light summary of overall system
health, recomputed every snapshot window:

- **RUNAWAY** (red): the combined drop+error rate exceeds 15%, or any node's
  circuit breaker is open. The system is actively failing requests.
- **SATURATED** (amber): no breaker is open and errors are under control, but
  some node is running at ≥85% utilization or the drop rate exceeds 1%. The
  system is under load and close to falling over.
- **STEADY** (green): everything else — the system is comfortably keeping up
  with traffic.

It's meant as a quick "is this design okay?" signal, not a substitute for
reading the per-node telemetry.
