import { createSimState, step } from "./engine";
import { summarize, percentile } from "./metrics";
import { applyChaos, type ChaosEvent } from "./chaos";
import type { SimState, SimEdge, FlowEvent, DropEvent } from "./types";
import { useDesignStore } from "../store/designStore";
import { useSimStore, type HistoryPoint, type Regime } from "../store/simStore";
import { findComponent } from "../palette/catalog";
import { varianceFor } from "./profiles";

/**
 * Bridges the pure simulation engine (src/sim/engine.ts) to the browser's
 * requestAnimationFrame loop and the two zustand stores: it reads the
 * current design from designStore, steps the engine each frame, and pushes
 * metric snapshots into simStore while writing per-node runtime state back
 * into designStore.
 */
export class SimRunner {
  private state: SimState | null = null;
  /** interval id for the tick loop (setInterval, not RAF, so background tabs keep simulating) */
  private raf: number | null = null;
  private lastTs: number | null = null;
  private windowMs = 0;
  private lastCompleted = 0;
  private paused = false;

  private build(): void {
    const { nodes, edges } = useDesignStore.getState();
    const nodeIds = new Set(nodes.map((n) => n.id));

    const nodeInits = nodes.map((n) => {
      const def = findComponent(n.data.componentId);
      return {
        id: n.id,
        componentId: n.data.componentId,
        serviceTimeMs: n.data.params.serviceTimeMs,
        concurrency: n.data.params.concurrency,
        capacity: n.data.params.capacity,
        failureRate: n.data.params.failureRate,
        isSource: def?.isSource ?? false,
        isSink: def?.isSink ?? false,
        genRatePerSec: n.data.genRatePerSec,
        variance: varianceFor(n.data.componentId),
      };
    });

    const simEdges: SimEdge[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target }));

    this.state = createSimState({ nodes: nodeInits, edges: simEdges, seed: 42 });
  }

  start(): void {
    if (this.raf != null) return;
    if (this.paused && this.state) {
      // resume the existing run rather than discarding it
      this.paused = false;
      useSimStore.getState().setRunning(true);
      this.lastTs = null;
      this.raf = window.setInterval(this.frame, 33);
      return;
    }
    this.paused = false;
    this.build();
    useSimStore.getState().setRunning(true);
    this.lastTs = null;
    this.windowMs = 0;
    this.lastCompleted = 0;
    this.raf = window.setInterval(this.frame, 33);
  }

  private frame = (): void => {
    const ts = performance.now();
    const dtMs = this.lastTs == null ? 16 : Math.min(100, ts - this.lastTs);
    this.lastTs = ts;

    if (this.state) {
      const { speed, traffic } = useSimStore.getState();
      step(this.state, dtMs, { speed, traffic });
      this.windowMs += dtMs * speed;
      if (this.windowMs >= 200) {
        this.snapshot(this.windowMs);
        this.windowMs = 0;
      }
    }
  };

  private snapshot(windowMs: number): void {
    if (!this.state) return;
    const m = this.state.metrics;
    const { traffic } = useSimStore.getState();

    if (m.latencySamples.length > 2000) {
      m.latencySamples = m.latencySamples.slice(-2000);
    }

    const summary = summarize(m);

    const deltaCompleted = m.completed - this.lastCompleted;
    this.lastCompleted = m.completed;
    const throughput = windowMs > 0 ? deltaCompleted / (windowMs / 1000) : 0;

    const point: HistoryPoint = {
      t: Math.round(m.simTimeMs),
      p50: summary.p50,
      p95: summary.p95,
      p99: summary.p99,
      throughput,
      dropRate: summary.dropRate,
    };

    let maxUtil = 0;
    let anyCbOpen = false;

    for (const id of this.state.order) {
      const n = this.state.nodes[id];
      const utilization = Math.min(1, n.busyMsThisWindow / (n.concurrency * windowMs || 1));
      const queueDepth = n.queue.length;
      const crashed = n.capacity === 0;
      // Generating sources never "complete" work themselves, so show their
      // outbound request rate instead of a always-zero processing rate.
      const windowTotal = n.windowCompleted;
      let rps = n.windowCompleted / (windowMs / 1000 || 1);
      if (n.isSource && n.genRatePerSec) rps = n.genRatePerSec * traffic;
      n.windowCompleted = 0;
      const errorPct = windowTotal > 0 ? n.windowErrors / windowTotal : 0;
      n.windowErrors = 0;
      const p95 = percentile(n.latencyWindow, 95);
      if (n.latencyWindow.length > 300) n.latencyWindow = n.latencyWindow.slice(-300);
      const cbState = n.cb.state;

      if (!n.isSource) maxUtil = Math.max(maxUtil, utilization);
      if (cbState === "open") anyCbOpen = true;

      useDesignStore.getState().updateNodeRuntime(id, {
        utilization,
        queueDepth,
        crashed,
        rps,
        p95,
        errorPct,
        cbState,
      });
      n.busyMsThisWindow = 0;
    }

    const totalOutcomes = summary.completed + summary.failed;
    const errRate = summary.dropRate + (totalOutcomes > 0 ? summary.failed / totalOutcomes : 0);
    const regime: Regime =
      errRate > 0.15 || anyCbOpen
        ? "RUNAWAY"
        : maxUtil >= 0.85 || summary.dropRate > 0.01
          ? "SATURATED"
          : "STEADY";

    useSimStore.getState().pushSnapshot(summary, point, regime);
  }

  pause(): void {
    if (this.raf != null) {
      clearInterval(this.raf);
      this.raf = null;
    }
    this.paused = true;
    useSimStore.getState().setRunning(false);
  }

  stepOnce(): void {
    if (!this.state) this.build();
    if (!this.state) return;
    const { traffic } = useSimStore.getState();
    step(this.state, 50, { speed: 1, traffic });
    this.snapshot(50);
  }

  stop(): void {
    if (this.raf != null) {
      clearInterval(this.raf);
      this.raf = null;
    }
    this.state = null;
    this.lastTs = null;
    this.windowMs = 0;
    this.lastCompleted = 0;
    this.paused = false;
    useSimStore.getState().reset();
    for (const n of useDesignStore.getState().nodes) {
      useDesignStore.getState().updateNodeRuntime(n.id, {
        utilization: 0,
        queueDepth: 0,
        crashed: false,
        rps: 0,
        p95: 0,
        errorPct: 0,
        cbState: "closed",
      });
    }
  }

  triggerChaos(ev: ChaosEvent): void {
    if (this.state) applyChaos(this.state, ev);
  }

  takeFlowEvents(): FlowEvent[] {
    if (!this.state) return [];
    return this.state.flowEvents.splice(0);
  }

  takeDropEvents(): DropEvent[] {
    if (!this.state) return [];
    return this.state.dropEvents.splice(0);
  }
}

export const runner = new SimRunner();
