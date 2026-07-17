import { create } from "zustand";
import type { MetricSummary } from "../sim/metrics";

export interface HistoryPoint {
  t: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
  dropRate: number;
}

const HISTORY_LIMIT = 120;

export type Regime = "STEADY" | "SATURATED" | "RUNAWAY";

interface SimState {
  running: boolean;
  speed: number;
  traffic: number;
  summary: MetricSummary | null;
  history: HistoryPoint[];
  regime: Regime;

  setRunning: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setTraffic: (v: number) => void;
  pushSnapshot: (summary: MetricSummary, point: HistoryPoint, regime?: Regime) => void;
  setRegime: (regime: Regime) => void;
  reset: () => void;
}

export const useSimStore = create<SimState>()((set, get) => ({
  running: false,
  speed: 1,
  traffic: 1,
  summary: null,
  history: [],
  regime: "STEADY",

  setRunning: (v) => set({ running: v }),
  setSpeed: (v) => set({ speed: v }),
  setTraffic: (v) => set({ traffic: v }),

  pushSnapshot: (summary, point, regime) => {
    const nextHistory = [...get().history, point];
    if (nextHistory.length > HISTORY_LIMIT) {
      nextHistory.splice(0, nextHistory.length - HISTORY_LIMIT);
    }
    set({ summary, history: nextHistory, ...(regime != null ? { regime } : {}) });
  },

  setRegime: (regime) => set({ regime }),

  reset: () => set({ running: false, summary: null, history: [], regime: "STEADY" }),
}));
