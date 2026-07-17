import type { Node, Edge } from "@xyflow/react";
import type { SystemNodeData } from "../store/designStore";
import { findComponent } from "../palette/catalog";

export interface PresetStep {
  id: string;
  componentId: string;
  genRatePerSec?: number;
}

export interface PresetSpec {
  id: string;
  name: string;
  steps: PresetStep[];
}

export const PRESETS: PresetSpec[] = [
  {
    id: "url-shortener",
    name: "URL Shortener",
    steps: [
      { id: "client-src", componentId: "client", genRatePerSec: 900 },
      { id: "api-gateway", componentId: "api-gateway" },
      { id: "app-server", componentId: "app-server" },
      { id: "cache", componentId: "cache" },
      { id: "client-sink", componentId: "client" },
    ],
  },
  {
    id: "news-feed",
    name: "News Feed",
    steps: [
      { id: "client-src", componentId: "client", genRatePerSec: 700 },
      { id: "load-balancer", componentId: "load-balancer" },
      { id: "app-server", componentId: "app-server" },
      { id: "nosql-db", componentId: "nosql-db" },
      { id: "client-sink", componentId: "client" },
    ],
  },
  {
    id: "chat",
    name: "Chat / Messaging",
    steps: [
      { id: "client-src", componentId: "client", genRatePerSec: 1100 },
      { id: "api-gateway", componentId: "api-gateway" },
      { id: "app-server", componentId: "app-server" },
      { id: "message-queue", componentId: "message-queue" },
      { id: "client-sink", componentId: "client" },
    ],
  },
];

export function buildPreset(spec: PresetSpec): {
  nodes: Node<SystemNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<SystemNodeData>[] = [];
  const edges: Edge[] = [];

  spec.steps.forEach((step, i) => {
    const def = findComponent(step.componentId);
    if (!def) return;
    nodes.push({
      id: step.id,
      type: "system",
      position: { x: 60 + i * 200, y: 160 },
      data: {
        componentId: def.id,
        label: def.name,
        params: { ...def.defaults },
        genRatePerSec: step.genRatePerSec,
        utilization: 0,
        queueDepth: 0,
        crashed: false,
        rps: 0,
        p95: 0,
      },
    });
  });

  for (let i = 0; i < spec.steps.length - 1; i++) {
    const a = spec.steps[i];
    const b = spec.steps[i + 1];
    edges.push({
      id: `${a.id}-${b.id}`,
      source: a.id,
      target: b.id,
    });
  }

  return { nodes, edges };
}

export function getPresetById(
  id: string
): { nodes: Node<SystemNodeData>[]; edges: Edge[] } | undefined {
  const spec = PRESETS.find((p) => p.id === id);
  return spec ? buildPreset(spec) : undefined;
}
