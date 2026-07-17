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
  rr: Record<string, number>; // round-robin counter per node, for fan-out routing
}

export interface RunParams { speed: number; traffic: number; }
