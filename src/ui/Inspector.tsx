import { useDesignStore } from "../store/designStore";
import { findComponent } from "../palette/catalog";

function Field({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600 mb-2">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isNaN(v)) return;
          onChange(v);
        }}
        className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
      />
    </label>
  );
}

export function Inspector() {
  const selectedNodeId = useDesignStore((s) => s.selectedNodeId);
  const nodes = useDesignStore((s) => s.nodes);
  const updateNodeParams = useDesignStore((s) => s.updateNodeParams);

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) {
    return (
      <div className="w-full h-full p-4 text-sm text-gray-400 italic">
        Select a node to edit its parameters
      </div>
    );
  }

  const { data } = node;
  const def = findComponent(data.componentId);

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 border-l border-gray-200 p-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{def?.icon}</span>
        <span className="font-semibold text-gray-800">{data.label}</span>
      </div>

      <Field
        label="Service time (ms)"
        value={data.params.serviceTimeMs}
        onChange={(v) => updateNodeParams(node.id, { serviceTimeMs: v })}
      />
      <Field
        label="Concurrency"
        value={data.params.concurrency}
        onChange={(v) => updateNodeParams(node.id, { concurrency: v })}
      />
      <Field
        label="Capacity (queue)"
        value={data.params.capacity}
        onChange={(v) => updateNodeParams(node.id, { capacity: v })}
      />
      <Field
        label="Failure rate (0..1)"
        value={data.params.failureRate}
        step={0.01}
        onChange={(v) => updateNodeParams(node.id, { failureRate: v })}
      />
      {def?.isSource && (
        <Field
          label="Traffic rate (req/s)"
          value={data.genRatePerSec ?? 0}
          onChange={(v) => updateNodeParams(node.id, { genRatePerSec: v })}
        />
      )}

      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Live
        </div>
        <div className="text-sm text-gray-700 flex justify-between mb-1">
          <span>Utilization</span>
          <span>{(data.utilization * 100).toFixed(0)}%</span>
        </div>
        <div className="text-sm text-gray-700 flex justify-between mb-1">
          <span>Queue depth</span>
          <span>{data.queueDepth}</span>
        </div>
        {data.crashed && (
          <div className="mt-2 inline-block bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            CRASHED
          </div>
        )}
      </div>
    </div>
  );
}

export default Inspector;
