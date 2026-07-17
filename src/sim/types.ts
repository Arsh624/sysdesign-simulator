export type CbState = "closed" | "open" | "half";

export interface Call {
  id: number;              // unique per call (also used for flow events)
  reqId: number;           // the request (root) id
  nodeId: string;
  parent: Call | null;     // null = root (returns to source)
  sourceId: string;        // the source node that generated the request
  enqueuedAtMs: number;
  phase: "queued" | "serving" | "waiting";
  remainingMs: number;     // serving countdown
  pendingChildren: number;
  childError: boolean;
  bornAtMs: number;        // request birth (copied from root)
  deadlineMs: number;      // bornAtMs + REQUEST_TIMEOUT_MS
}

export interface SimNode {
  id: string;
  componentId: string;
  serviceTimeMs: number;    // BASE local service time (chaos mutates this)
  concurrency: number;      // worker pool size
  capacity: number;         // queue bound (chaos crash sets 0)
  failureRate: number;
  isSource: boolean;
  isSink: boolean;
  genRatePerSec?: number;
  variance: number;         // lognormal sigma, e.g. 0.4
  // runtime:
  queue: Call[];
  active: Call[];           // serving OR waiting (each holds a worker)
  busyMsThisWindow: number;
  completedCount: number;   // calls returned from this node
  errorCount: number;       // calls returned as error from this node
  windowCompleted: number;  // per-snapshot-window counters (runner resets)
  windowErrors: number;
  latencyWindow: number[];  // per-call total durations at this node (enqueue->return), cap 500
  cb: { state: CbState; recent: number[]; openedAtMs: number };
}

export interface SimEdge { id: string; source: string; target: string; }

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
  nextCallId: number;
  inFlight: number;          // live requests
  rng: () => number;         // seeded, injectable
  genCarry: Record<string, number>; // fractional request accumulator per source
  flowEvents: FlowEvent[];
  dropEvents: DropEvent[];
}

export interface RunParams { speed: number; traffic: number; }

export interface FlowEvent { id: number; sourceId: string; targetId: string; bornAtMs: number; }
export interface DropEvent { id: number; nodeId: string; atMs: number; }
