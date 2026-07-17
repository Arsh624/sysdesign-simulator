import type { SimState, SimNode, SimEdge, RunParams, RequestToken } from "./types";

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
    nextTokenId: 1, genCarry, rr: {},
  };
}

const SUBSTEP_MS = 1;

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
  // 2. advance in-service work and admit from queue for every node
  for (const id of state.order) {
    const n = state.nodes[id];
    if (n.isSink) continue;
    // advance in-service
    const stillBusy: typeof n.inService = [];
    for (const item of n.inService) {
      item.remainingMs -= dtMs;
      if (item.remainingMs <= 0) {
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
}

function drainSinks(state: SimState) {
  for (const id of state.order) {
    const n = state.nodes[id];
    if (!n.isSink) continue;
    for (const token of n.queue.splice(0)) {
      state.metrics.completed += 1;
      state.metrics.latencySamples.push(state.metrics.simTimeMs - token.bornAtMs);
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
    state.metrics.latencySamples.push(state.metrics.simTimeMs - token.bornAtMs);
    return;
  }
  // round-robin across all outgoing edges
  const i = (state.rr[fromId] ?? 0) % edges.length;
  state.rr[fromId] = (state.rr[fromId] ?? 0) + 1;
  const target = state.nodes[edges[i].target];
  enqueue(state, target, token);
}

export function enqueue(state: SimState, node: SimNode, token: RequestToken) {
  if (node.queue.length >= node.capacity) { state.metrics.dropped += 1; return; }
  node.queue.push(token);
}
