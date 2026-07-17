import { create } from "zustand";
import {
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import type { SimDefaults } from "../palette/types";
import { findComponent } from "../palette/catalog";

export interface SystemNodeData extends Record<string, unknown> {
  componentId: string;
  label: string;
  params: SimDefaults;
  genRatePerSec?: number;
  utilization: number;
  queueDepth: number;
  crashed: boolean;
}

let nodeCounter = 0;

interface DesignState {
  nodes: Node<SystemNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;

  addNode: (componentId: string, position: { x: number; y: number }) => void;
  updateNodeParams: (
    id: string,
    partial: Partial<SimDefaults & { genRatePerSec: number }>
  ) => void;
  updateNodeRuntime: (
    id: string,
    rt: { utilization: number; queueDepth: number; crashed: boolean }
  ) => void;
  onNodesChange: (changes: NodeChange<Node<SystemNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setSelected: (id: string | null) => void;
  loadDesign: (d: { nodes: Node<SystemNodeData>[]; edges: Edge[] }) => void;
  clear: () => void;
}

export const useDesignStore = create<DesignState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

  addNode: (componentId, position) => {
    const def = findComponent(componentId);
    if (!def) return;
    nodeCounter += 1;
    const id = `${componentId}-${nodeCounter}`;
    const newNode: Node<SystemNodeData> = {
      id,
      type: "system",
      position,
      data: {
        componentId,
        label: def.name,
        params: { ...def.defaults },
        genRatePerSec: def.isSource ? 10 : undefined,
        utilization: 0,
        queueDepth: 0,
        crashed: false,
      },
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeParams: (id, partial) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id !== id) return n;
        const { genRatePerSec, ...paramsPartial } = partial;
        return {
          ...n,
          data: {
            ...n.data,
            params: { ...n.data.params, ...paramsPartial },
            genRatePerSec:
              genRatePerSec !== undefined ? genRatePerSec : n.data.genRatePerSec,
          },
        };
      }),
    });
  },

  updateNodeRuntime: (id, rt) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                utilization: rt.utilization,
                queueDepth: rt.queueDepth,
                crashed: rt.crashed,
              },
            }
          : n
      ),
    });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  setSelected: (id) => set({ selectedNodeId: id }),

  loadDesign: (d) => set({ nodes: d.nodes, edges: d.edges, selectedNodeId: null }),

  clear: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}));
