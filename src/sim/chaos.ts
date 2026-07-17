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
