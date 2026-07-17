import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { findComponent } from "../palette/catalog";
import type { SystemNodeData } from "../store/designStore";
import { useSimStore } from "../store/simStore";

// Interpolates green (low utilization) -> amber (~0.6) -> red (~0.9+).
export function utilizationColor(u: number): string {
  const clamped = Math.max(0, Math.min(1, u));

  // Stops: 0 -> green, 0.6 -> amber, 1 -> red
  const green = { r: 74, g: 222, b: 128 }; // tailwind green-400
  const amber = { r: 251, g: 191, b: 36 }; // tailwind amber-400
  const red = { r: 248, g: 113, b: 113 }; // tailwind red-400

  let start = green;
  let end = amber;
  let t = 0;

  if (clamped <= 0.6) {
    start = green;
    end = amber;
    t = clamped / 0.6;
  } else {
    start = amber;
    end = red;
    t = (clamped - 0.6) / 0.4;
  }

  const r = Math.round(start.r + (end.r - start.r) * t);
  const g = Math.round(start.g + (end.g - start.g) * t);
  const b = Math.round(start.b + (end.b - start.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

function SystemNode(props: NodeProps) {
  const { data } = props as NodeProps<Node<SystemNodeData>>;
  const def = findComponent(data.componentId);
  const running = useSimStore((s) => s.running);
  const borderClass = data.crashed
    ? "border-4 border-red-600"
    : "border border-gray-400";
  const showTelemetry = running || data.utilization > 0;
  const utilPct = Math.round(data.utilization * 100);

  return (
    <div
      className={`min-w-[120px] rounded-lg px-3 py-2 shadow-md ${borderClass}`}
      style={{ background: utilizationColor(data.utilization) }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
        <span>{def?.icon}</span>
        <span>{data.label}</span>
      </div>
      {showTelemetry && (
        <div className="mt-1 min-h-[26px] w-full">
          <div className="flex items-center justify-between text-[10px] leading-tight text-gray-800">
            <span>Load {utilPct}%</span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-black/15">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, utilPct))}%`,
                backgroundColor: utilizationColor(data.utilization),
              }}
            />
          </div>
          {data.queueDepth > 0 && (
            <div className="mt-0.5 text-[10px] leading-tight text-gray-800">
              Q {data.queueDepth}
            </div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(SystemNode);
