import type { SimState, SimNode, SimEdge, RunParams, Call } from "./types";

interface NodeInit {
  id: string; componentId: string; serviceTimeMs: number; concurrency: number;
  capacity: number; failureRate: number; isSource: boolean; isSink: boolean;
  genRatePerSec?: number; variance?: number;
}
interface StateInit { nodes: NodeInit[]; edges: SimEdge[]; seed?: number; }

const SUBSTEP_MS = 1;
const REQUEST_TIMEOUT_MS = 5000;
const CB_WINDOW = 25;
const CB_ERR_THRESHOLD = 0.5;
const CB_COOLDOWN_MS = 2000;
const CB_MIN_SAMPLES = 10;
// Sentinel used to permanently disarm a call's pendingChildren counter once it
// has already returned (e.g. via timeout) so that orphaned children finishing
// later can never spuriously re-trigger its parent bubbling.
const ORPHANED = -1_000_000_000;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleServiceMs(state: SimState, node: SimNode): number {
  if (node.serviceTimeMs <= 0) return 0;
  const z = gaussian(state.rng);
  return node.serviceTimeMs * Math.exp(node.variance * z);
}

export function createSimState(init: StateInit): SimState {
  const nodes: Record<string, SimNode> = {};
  const genCarry: Record<string, number> = {};
  for (const n of init.nodes) {
    nodes[n.id] = {
      ...n,
      variance: n.variance ?? 0.4,
      queue: [],
      active: [],
      busyMsThisWindow: 0,
      completedCount: 0,
      errorCount: 0,
      windowCompleted: 0,
      windowErrors: 0,
      latencyWindow: [],
      cb: { state: "closed", recent: [], openedAtMs: -Infinity },
    };
    if (n.isSource) genCarry[n.id] = 0;
  }
  const outgoing: Record<string, SimEdge[]> = {};
  for (const e of init.edges) (outgoing[e.source] ??= []).push(e);
  return {
    nodes,
    order: init.nodes.map((n) => n.id),
    edges: init.edges,
    outgoing,
    metrics: { completed: 0, dropped: 0, failed: 0, latencySamples: [], throughputWindow: [], simTimeMs: 0 },
    nextCallId: 1,
    inFlight: 0,
    rng: mulberry32(init.seed ?? 42),
    genCarry,
    flowEvents: [],
    dropEvents: [],
  };
}

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

function trimFlowEvents(state: SimState) {
  if (state.flowEvents.length > 10000) state.flowEvents.splice(0, 5000);
}
function trimDropEvents(state: SimState) {
  if (state.dropEvents.length > 10000) state.dropEvents.splice(0, 5000);
}

function makeCall(state: SimState, nodeId: string, parent: Call | null, reqId: number, sourceId: string, bornAtMs: number): Call {
  return {
    id: state.nextCallId++,
    reqId,
    nodeId,
    parent,
    sourceId,
    enqueuedAtMs: state.metrics.simTimeMs,
    phase: "queued",
    remainingMs: 0,
    pendingChildren: 0,
    childError: false,
    bornAtMs,
    deadlineMs: bornAtMs + REQUEST_TIMEOUT_MS,
  };
}

function removeFromActive(node: SimNode, call: Call) {
  const idx = node.active.indexOf(call);
  if (idx >= 0) node.active.splice(idx, 1);
}

function feedBreaker(state: SimState, node: SimNode, isError: boolean) {
  const cb = node.cb;
  if (cb.state === "half") {
    if (isError) {
      cb.state = "open";
      cb.openedAtMs = state.metrics.simTimeMs;
      cb.recent = [];
    } else {
      cb.state = "closed";
      cb.recent = [];
    }
    return;
  }
  cb.recent.push(isError ? 1 : 0);
  if (cb.recent.length > CB_WINDOW) cb.recent.splice(0, cb.recent.length - CB_WINDOW);
  if (cb.state !== "open" && cb.recent.length >= CB_MIN_SAMPLES) {
    const mean = cb.recent.reduce((a, b) => a + b, 0) / cb.recent.length;
    if (mean >= CB_ERR_THRESHOLD) {
      cb.state = "open";
      cb.openedAtMs = state.metrics.simTimeMs;
    }
  }
}

// A call has finished (successfully or not) at call.nodeId. Bubble the result
// up to its parent (recursively, since a parent only settles once every one
// of its children has returned), or — if this was the root — complete the
// whole request.
function returnCall(state: SimState, call: Call, isError: boolean, recordAtNode = true) {
  const node = state.nodes[call.nodeId];
  if (recordAtNode && !node.isSource) {
    node.completedCount += 1;
    node.windowCompleted += 1;
    if (isError) {
      node.errorCount += 1;
      node.windowErrors += 1;
    }
    const dur = state.metrics.simTimeMs - call.enqueuedAtMs;
    node.latencyWindow.push(dur);
    if (node.latencyWindow.length > 500) node.latencyWindow.splice(0, node.latencyWindow.length - 500);
  }

  const parent = call.parent;
  if (parent === null) {
    state.inFlight -= 1;
    const latency = state.metrics.simTimeMs - call.bornAtMs;
    if (isError) state.metrics.failed += 1;
    else state.metrics.completed += 1;
    state.metrics.latencySamples.push(latency);
    return;
  }

  const parentNode = state.nodes[parent.nodeId];
  feedBreaker(state, parentNode, isError);
  state.flowEvents.push({ id: call.id, sourceId: call.nodeId, targetId: parent.nodeId, bornAtMs: state.metrics.simTimeMs });
  trimFlowEvents(state);

  parent.pendingChildren -= 1;
  parent.childError = parent.childError || isError;
  if (parent.pendingChildren === 0 && parent.phase === "waiting") {
    if (!parentNode.isSource) removeFromActive(parentNode, parent);
    returnCall(state, parent, parent.childError);
  }
}

function enqueueCall(state: SimState, target: SimNode, call: Call) {
  if (target.capacity <= 0 || target.queue.length >= target.capacity) {
    state.metrics.dropped += 1;
    state.dropEvents.push({ id: call.id, nodeId: target.id, atMs: state.metrics.simTimeMs });
    trimDropEvents(state);
    returnCall(state, call, true, false);
    return;
  }
  call.enqueuedAtMs = state.metrics.simTimeMs;
  target.queue.push(call);
}

// A call has finished its LOCAL service time at `node`. Decide what happens
// next: fast-fail via an open breaker, return immediately (leaf node), or
// fan out to every outgoing edge in parallel and wait for all of them.
function finishLocalService(state: SimState, node: SimNode, call: Call): "waiting" | "done" {
  const localFail = state.rng() < node.failureRate;
  const edges = state.outgoing[node.id] ?? [];

  if (node.cb.state === "open") {
    if (state.metrics.simTimeMs - node.cb.openedAtMs >= CB_COOLDOWN_MS) {
      node.cb.state = "half";
    } else {
      returnCall(state, call, true);
      return "done";
    }
  }

  if (edges.length === 0) {
    returnCall(state, call, localFail);
    return "done";
  }

  call.phase = "waiting";
  call.pendingChildren = edges.length;
  call.childError = localFail;
  for (const e of edges) {
    const child = makeCall(state, e.target, call, call.reqId, call.sourceId, call.bornAtMs);
    state.flowEvents.push({ id: child.id, sourceId: node.id, targetId: e.target, bornAtMs: state.metrics.simTimeMs });
    trimFlowEvents(state);
    enqueueCall(state, state.nodes[e.target], child);
  }
  return "waiting";
}

function subStep(state: SimState, dtMs: number, params: RunParams) {
  state.metrics.simTimeMs += dtMs;

  // 1. generate at sources
  for (const id of state.order) {
    const node = state.nodes[id];
    if (!node.isSource || !node.genRatePerSec) continue;
    state.genCarry[id] += (node.genRatePerSec * params.traffic * dtMs) / 1000;
    while (state.genCarry[id] >= 1) {
      state.genCarry[id] -= 1;
      const reqId = state.nextCallId++;
      const bornAtMs = state.metrics.simTimeMs;
      const edges = state.outgoing[id] ?? [];
      state.inFlight += 1;
      if (edges.length === 0) {
        state.inFlight -= 1;
        state.metrics.completed += 1;
        state.metrics.latencySamples.push(0);
        continue;
      }
      const root = makeCall(state, id, null, reqId, id, bornAtMs);
      root.phase = "waiting";
      root.pendingChildren = edges.length;
      root.childError = false;
      for (const e of edges) {
        const child = makeCall(state, e.target, root, reqId, id, bornAtMs);
        state.flowEvents.push({ id: child.id, sourceId: id, targetId: e.target, bornAtMs });
        trimFlowEvents(state);
        enqueueCall(state, state.nodes[e.target], child);
      }
    }
  }

  // 2. per node: timeouts, advance serving calls, admit from queue
  for (const id of state.order) {
    const node = state.nodes[id];
    if (node.isSource) continue;

    // timeouts for calls still sitting in queue (never got a worker)
    if (node.queue.length > 0) {
      const keep: Call[] = [];
      for (const call of node.queue) {
        if (state.metrics.simTimeMs > call.deadlineMs) {
          returnCall(state, call, true);
        } else {
          keep.push(call);
        }
      }
      node.queue = keep;
    }

    // advance active calls (serving or waiting on children)
    const nextActive: Call[] = [];
    for (const call of node.active) {
      if (call.phase === "waiting") {
        if (state.metrics.simTimeMs > call.deadlineMs) {
          call.pendingChildren = ORPHANED;
          returnCall(state, call, true);
          continue; // worker freed
        }
        nextActive.push(call);
        continue;
      }
      // serving
      call.remainingMs -= dtMs;
      if (call.remainingMs <= 0) {
        const outcome = finishLocalService(state, node, call);
        if (outcome === "waiting") nextActive.push(call);
        // else: call already returned, worker freed
      } else {
        nextActive.push(call);
      }
    }
    node.active = nextActive;

    // admit from queue to fill any free workers
    while (node.active.length < node.concurrency && node.queue.length > 0) {
      const call = node.queue.shift()!;
      call.phase = "serving";
      call.remainingMs = sampleServiceMs(state, node);
      node.active.push(call);
    }

    // utilization accounting: serving AND waiting both hold a worker
    node.busyMsThisWindow += node.active.length * dtMs;
  }
}
