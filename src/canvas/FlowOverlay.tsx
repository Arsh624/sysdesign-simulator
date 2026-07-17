import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { runner } from "../sim/runner";
import { useDesignStore } from "../store/designStore";

const TRAVEL_MS = 750;
const FLASH_MS = 450;
const MAX_PARTICLES = 350;
const MAX_FLASHES = 100;

interface Particle {
  sourceId: string;
  targetId: string;
  start: number;
  /** true if this particle rides the wire for edge sourceId->targetId backward (a response hop) */
  isResponse: boolean;
}

interface DropFlash {
  nodeId: string;
  start: number;
}

interface PathInfo {
  path: SVGPathElement;
  total: number;
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = t <= 0 ? a : t >= 1 ? b : a.map((v, i) => v + (b[i] - v) * t);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const GREEN: [number, number, number] = [34, 197, 94]; // #22c55e
const AMBER: [number, number, number] = [245, 158, 11]; // #f59e0b
const RED: [number, number, number] = [239, 68, 68]; // #ef4444

function packetColor(util: number, crashed: boolean): string {
  if (crashed) return `rgb(${RED[0]}, ${RED[1]}, ${RED[2]})`;
  const t = Math.max(0, Math.min(1, util));
  if (t <= 0.5) return lerpColor(GREEN, AMBER, t / 0.5);
  return lerpColor(AMBER, RED, (t - 0.5) / 0.5);
}

/** Sample a point + tangent angle at arc-length fraction t in [0,1] along an SVG path. */
function pointAtT(info: PathInfo, t: number): { x: number; y: number; angle: number } {
  const { path, total } = info;
  const clampedT = Math.max(0, Math.min(1, t));
  const L = clampedT * total;
  const p = path.getPointAtLength(L);

  const dL = 2;
  const L0 = Math.max(0, L - dL);
  const L1 = Math.min(total, L + dL);
  const p0 = path.getPointAtLength(L0);
  const p1 = path.getPointAtLength(L1);
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  return { x: p.x, y: p.y, angle };
}

export default function FlowOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const flashesRef = useRef<DropFlash[]>([]);
  const rafRef = useRef<number | null>(null);
  const { getViewport } = useReactFlow();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      const now = performance.now();
      const flows = runner.takeFlowEvents();
      const drops = runner.takeDropEvents();

      const { x: vx, y: vy, zoom } = getViewport();
      const nodes = useDesignStore.getState().nodes;
      const edges = useDesignStore.getState().edges;
      const nodeMap = new Map<
        string,
        {
          cx: number;
          cy: number;
          w: number;
          util: number;
          crashed: boolean;
          queueDepth: number;
        }
      >();
      for (const n of nodes) {
        const w = n.measured?.width ?? 150;
        const h = n.measured?.height ?? 60;
        nodeMap.set(n.id, {
          cx: n.position.x + w / 2,
          cy: n.position.y + h / 2,
          w,
          util: n.data.utilization ?? 0,
          crashed: n.data.crashed ?? false,
          queueDepth: n.data.queueDepth ?? 0,
        });
      }

      // Sample React Flow's actual rendered SVG edge paths once per frame, keyed by edge id.
      const pathById = new Map<string, PathInfo>();
      try {
        const pathEls = document.querySelectorAll<SVGPathElement>(".react-flow__edge-path");
        pathEls.forEach((path) => {
          try {
            const edgeEl = path.closest(".react-flow__edge");
            const id = edgeEl?.getAttribute("data-id");
            if (!id) return;
            const total = path.getTotalLength();
            if (!total || !Number.isFinite(total) || total <= 0) return;
            pathById.set(id, { path, total });
          } catch {
            // detached/invalid path — skip
          }
        });
      } catch {
        // querySelectorAll can theoretically throw in exotic environments — skip this frame's wires
      }

      // Match a drawn edge (source->target) to its rendered path.
      const pathByEdgeKey = new Map<string, PathInfo>();
      for (const e of edges) {
        const info = pathById.get(e.id);
        if (!info) continue;
        pathByEdgeKey.set(`${e.source}->${e.target}`, info);
      }

      // Match incoming flow events to a drawn edge's path; drop events with no matching wire.
      for (const f of flows) {
        if (particlesRef.current.length >= MAX_PARTICLES) continue;
        if (pathByEdgeKey.has(`${f.sourceId}->${f.targetId}`)) {
          particlesRef.current.push({
            sourceId: f.sourceId,
            targetId: f.targetId,
            start: now,
            isResponse: false,
          });
        } else if (pathByEdgeKey.has(`${f.targetId}->${f.sourceId}`)) {
          // Response hop: travels the drawn edge targetId->? backward, i.e. along edge (f.targetId -> f.sourceId).
          particlesRef.current.push({
            sourceId: f.targetId,
            targetId: f.sourceId,
            start: now,
            isResponse: true,
          });
        }
        // else: no matching drawn wire in either direction — skip, never draw off-wire packets.
      }
      for (const d of drops) {
        if (flashesRef.current.length < MAX_FLASHES) {
          flashesRef.current.push({ nodeId: d.nodeId, start: now });
        }
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cssW = rect.width || canvas.clientWidth;
      const cssH = rect.height || canvas.clientHeight;
      const targetW = Math.max(1, Math.round(cssW * dpr));
      const targetH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const toScreen = (fx: number, fy: number): [number, number] => [fx * zoom + vx, fy * zoom + vy];

      // queued-up piles (bottleneck bunching)
      for (const [, info] of nodeMap) {
        if (info.queueDepth <= 0) continue;
        const count = Math.min(info.queueDepth, 12);
        const color = lerpColor([245, 158, 11], RED, Math.max(0, Math.min(1, info.util)));
        for (let k = 0; k < count; k++) {
          const jitter = ((k * 37) % 11) - 5;
          const fx = info.cx - info.w / 2 - 6 - k * 5;
          const fy = info.cy + jitter;
          const [sx, sy] = toScreen(fx, fy);
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.arc(sx, sy, Math.max(1.5, 2 * zoom), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // wire pass: red error wires + label for edges whose target is failing, stroking the real SVG path
      for (const e of edges) {
        const T = nodeMap.get(e.target);
        if (!T) continue;
        const failing = T.crashed || T.util >= 0.85;
        if (!failing) continue;
        const info = pathByEdgeKey.get(`${e.source}->${e.target}`);
        if (!info) continue;

        try {
          const d = info.path.getAttribute("d");
          if (!d) continue;
          const p2d = new Path2D(d);

          ctx.save();
          // Flow coords -> device pixels: same pan/zoom as toScreen, scaled by dpr.
          ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * vx, dpr * vy);
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2.5 / zoom;
          ctx.stroke(p2d);
          ctx.restore();
          // restore the base dpr transform used by the rest of this pass
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } catch {
          continue;
        }

        const mid = pointAtT(info, 0.5);
        const [mx, my] = toScreen(mid.x, mid.y);
        const label = "error";
        ctx.font = `${Math.max(9, 9 * zoom)}px sans-serif`;
        const textW = ctx.measureText(label).width;
        const padX = 5 * zoom;
        const padY = 3 * zoom;
        const badgeW = textW + padX * 2;
        const badgeH = 9 * zoom + padY * 2;
        const radius = badgeH / 2;

        ctx.beginPath();
        ctx.fillStyle = "#ef4444";
        const bx = mx - badgeW / 2;
        const by = my - badgeH / 2;
        ctx.moveTo(bx + radius, by);
        ctx.arcTo(bx + badgeW, by, bx + badgeW, by + badgeH, radius);
        ctx.arcTo(bx + badgeW, by + badgeH, bx, by + badgeH, radius);
        ctx.arcTo(bx, by + badgeH, bx, by, radius);
        ctx.arcTo(bx, by, bx + badgeW, by, radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my + 0.5);
      }

      // traveling particles: pills riding the real SVG path of the drawn wire
      ctx.globalCompositeOperation = "lighter";
      particlesRef.current = particlesRef.current.filter((p) => {
        const rawT = (now - p.start) / TRAVEL_MS;
        if (rawT >= 1) return false;
        const info = pathByEdgeKey.get(`${p.sourceId}->${p.targetId}`);
        if (!info) return false;
        // Response particles ride the same path but travel backward (t: 1 -> 0).
        const t = p.isResponse ? 1 - rawT : rawT;

        let sample;
        try {
          sample = pointAtT(info, t);
        } catch {
          return false;
        }
        const { x: fx, y: fy, angle } = sample;
        const [sx, sy] = toScreen(fx, fy);

        // Utilization/crash coloring is keyed off the logical destination of this hop.
        const destId = p.isResponse ? p.sourceId : p.targetId;
        const dest = nodeMap.get(destId);
        const util = dest?.crashed ? 1 : Math.max(0, Math.min(1, dest?.util ?? 0));
        const crashed = dest?.crashed ?? false;
        const color = packetColor(util, crashed);

        const drawAngle = p.isResponse ? angle + Math.PI : angle;
        const sizeScale = p.isResponse ? 0.75 : 1;
        const length = Math.max(3, 9 * zoom) * sizeScale;
        const thickness = Math.max(1.2, 3.5 * zoom) * sizeScale;
        const glowR = thickness * 2.5;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(drawAngle);
        ctx.globalAlpha = p.isResponse ? 0.6 : 1;

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(0, 0, glowR, 0, Math.PI * 2);
        ctx.fill();

        const halfL = length / 2;
        const halfT = thickness / 2;
        ctx.beginPath();
        if (p.isResponse) {
          // hollow outline for response packets so both directions read clearly on one wire
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(0.75, thickness * 0.3);
          ctx.moveTo(-halfL + halfT, -halfT);
          ctx.lineTo(halfL - halfT, -halfT);
          ctx.arc(halfL - halfT, 0, halfT, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(-halfL + halfT, halfT);
          ctx.arc(-halfL + halfT, 0, halfT, Math.PI / 2, -Math.PI / 2);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.moveTo(-halfL + halfT, -halfT);
          ctx.lineTo(halfL - halfT, -halfT);
          ctx.arc(halfL - halfT, 0, halfT, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(-halfL + halfT, halfT);
          ctx.arc(-halfL + halfT, 0, halfT, Math.PI / 2, -Math.PI / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();

        return true;
      });
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      // drop flashes
      flashesRef.current = flashesRef.current.filter((f) => {
        const t = (now - f.start) / FLASH_MS;
        if (t >= 1) return false;
        const N = nodeMap.get(f.nodeId);
        if (!N) return false;
        const [sx, sy] = toScreen(N.cx, N.cy);
        const radius = (2 + t * 12) * zoom;
        const alpha = 1 - t;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      });
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [getViewport]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
