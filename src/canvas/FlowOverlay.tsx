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
const RED: [number, number, number] = [239, 68, 68]; // #ef4444

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
      const nodeMap = new Map<
        string,
        { cx: number; cy: number; w: number; h: number; util: number; crashed: boolean; queueDepth: number }
      >();
      for (const n of nodes) {
        const w = n.measured?.width ?? 150;
        const h = n.measured?.height ?? 60;
        nodeMap.set(n.id, {
          cx: n.position.x + w / 2,
          cy: n.position.y + h / 2,
          w,
          h,
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

      // traveling particles
      ctx.globalCompositeOperation = "lighter";
      particlesRef.current = particlesRef.current.filter((p) => {
        const t = (now - p.start) / TRAVEL_MS;
        if (t >= 1) return false;
        const S = nodeMap.get(p.sourceId);
        const T = nodeMap.get(p.targetId);
        if (!S || !T) return false;

        const fx = S.cx + (T.cx - S.cx) * t;
        const fy = S.cy + (T.cy - S.cy) * t;
        const [sx, sy] = toScreen(fx, fy);

        const util = T.crashed ? 1 : Math.max(0, Math.min(1, T.util));
        const color = lerpColor(GREEN, RED, util);
        const r = Math.max(2, 3 * zoom);

        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();

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
