import { createSimState, step } from "./engine";
import { summarize } from "./metrics";
import { applyChaos, type ChaosEvent } from "./chaos";
import type { SimState, SimEdge, FlowEvent, DropEvent } from "./types";
import { useDesignStore } from "../store/designStore";
import { useSimStore, type HistoryPoint } from "../store/simStore";
import { findComponent } from "../palette/catalog";

/**
 * Bridges the pure simulation engine (src/sim/engine.ts) to the browser's
 * requestAnimationFrame loop and the two zustand stores: it reads the
 * current design from designStore, steps the engine each frame, and pushes
 * metric snapshots into simStore while writing per-node runtime state back
 * into designStore.
 */
export class SimRunner {
  private state: SimState | null = null;
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
      };
    });

    const simEdges: SimEdge[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target }));

    this.state = createSimState({ nodes: nodeInits, edges: simEdges });
  }

  start(): void {
    if (this.raf != null) return;
    if (this.paused && this.state) {
      // resume the existing run rather than discarding it
      this.paused = false;
      useSimStore.getState().setRunning(true);
      this.lastTs = null;
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.paused = false;
    this.build();
    useSimStore.getState().setRunning(true);
    this.lastTs = null;
    this.windowMs = 0;
    this.lastCompleted = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (ts: number): void => {
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

    this.raf = requestAnimationFrame(this.frame);
  };

  private snapshot(windowMs: number): void {
    if (!this.state) return;
    const m = this.state.metrics;

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
    useSimStore.getState().pushSnapshot(summary, point);

    for (const id of this.state.order) {
      const n = this.state.nodes[id];
      const utilization = Math.min(1, n.busyMsThisWindow / (n.concurrency * windowMs || 1));
      const queueDepth = n.queue.length;
      const crashed = n.capacity === 0;
      useDesignStore.getState().updateNodeRuntime(id, { utilization, queueDepth, crashed });
      n.busyMsThisWindow = 0;
    }
  }

  pause(): void {
    if (this.raf != null) {
      cancelAnimationFrame(this.raf);
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
      cancelAnimationFrame(this.raf);
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
