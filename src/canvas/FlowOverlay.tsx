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
}

interface DropFlash {
  nodeId: string;
  start: number;
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

      for (const f of flows) {
        if (particlesRef.current.length < MAX_PARTICLES) {
          particlesRef.current.push({ sourceId: f.sourceId, targetId: f.targetId, start: now });
        }
      }
      for (const d of drops) {
        if (flashesRef.current.length < MAX_FLASHES) {
          flashesRef.current.push({ nodeId: d.nodeId, start: now });
        }
      }

      const { x: vx, y: vy, zoom } = getViewport();
      const nodes = useDesignStore.getState().nodes;
      const edges = useDesignStore.getState().edges;
      const nodeMap = new Map<
        string,
        {
          cx: number;
          cy: number;
          w: number;
          h: number;
          exitX: number;
          exitY: number;
          entryX: number;
          entryY: number;
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
          h,
          exitX: n.position.x + w,
          exitY: n.position.y + h / 2,
          entryX: n.position.x,
          entryY: n.position.y + h / 2,
          util: n.data.utilization ?? 0,
          crashed: n.data.crashed ?? false,
          queueDepth: n.data.queueDepth ?? 0,
        });
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

      // wire pass: red error wires + label for edges whose target is failing
      for (const e of edges) {
        const S = nodeMap.get(e.source);
        const T = nodeMap.get(e.target);
        if (!S || !T) continue;
        const failing = T.crashed || T.util >= 0.85;
        if (!failing) continue;

        const [x1, y1] = toScreen(S.exitX, S.exitY);
        const [x2, y2] = toScreen(T.entryX, T.entryY);

        ctx.beginPath();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = Math.max(1, 2 * zoom);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
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

      // traveling particles: pills riding the wire between box edges
      ctx.globalCompositeOperation = "lighter";
      particlesRef.current = particlesRef.current.filter((p) => {
        const t = (now - p.start) / TRAVEL_MS;
        if (t >= 1) return false;
        const S = nodeMap.get(p.sourceId);
        const T = nodeMap.get(p.targetId);
        if (!S || !T) return false;

        const fx = S.exitX + (T.entryX - S.exitX) * t;
        const fy = S.exitY + (T.entryY - S.exitY) * t;
        const [sx, sy] = toScreen(fx, fy);

        const util = T.crashed ? 1 : Math.max(0, Math.min(1, T.util));
        const color = packetColor(util, T.crashed);

        const angle = Math.atan2(T.entryY - S.exitY, T.entryX - S.exitX);
        const length = Math.max(3, 9 * zoom);
        const thickness = Math.max(1.2, 3.5 * zoom);
        const glowR = thickness * 2.5;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

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
        ctx.fillStyle = color;
        ctx.moveTo(-halfL + halfT, -halfT);
        ctx.lineTo(halfL - halfT, -halfT);
        ctx.arc(halfL - halfT, 0, halfT, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-halfL + halfT, halfT);
        ctx.arc(-halfL + halfT, 0, halfT, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        return true;
      });
      ctx.globalCompositeOperation = "source-over";

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
