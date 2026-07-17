import { runner } from "../sim/runner";
import { useDesignStore } from "../store/designStore";
import { useSimStore } from "../store/simStore";

function ChaosControls() {
  const selectedNodeId = useDesignStore((s) => s.selectedNodeId);
  const setTraffic = useSimStore((s) => s.setTraffic);

  const disabled = selectedNodeId == null;
  const nodeBtnClass =
    "px-2 py-1 rounded border text-sm border-red-400 text-red-700 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed";
  const recoverBtnClass =
    "px-2 py-1 rounded border text-sm border-green-400 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Chaos:</span>
      <button
        type="button"
        className={nodeBtnClass}
        disabled={disabled}
        title={disabled ? "Select a node first" : undefined}
        onClick={() => {
          if (!selectedNodeId) return;
          runner.triggerChaos({ kind: "latency-spike", nodeId: selectedNodeId, factor: 5 });
        }}
      >
        ⚡ Latency spike
      </button>
      <button
        type="button"
        className={nodeBtnClass}
        disabled={disabled}
        title={disabled ? "Select a node first" : undefined}
        onClick={() => {
          if (!selectedNodeId) return;
          runner.triggerChaos({ kind: "slowdown", nodeId: selectedNodeId, factor: 2 });
        }}
      >
        🐌 Slowdown
      </button>
      <button
        type="button"
        className={nodeBtnClass}
        disabled={disabled}
        title={disabled ? "Select a node first" : undefined}
        onClick={() => {
          if (!selectedNodeId) return;
          runner.triggerChaos({ kind: "crash", nodeId: selectedNodeId });
        }}
      >
        💥 Crash
      </button>
      <button
        type="button"
        className={recoverBtnClass}
        disabled={disabled}
        title={disabled ? "Select a node first" : undefined}
        onClick={() => {
          if (!selectedNodeId) return;
          runner.triggerChaos({ kind: "recover", nodeId: selectedNodeId });
        }}
      >
        🔧 Recover
      </button>
      <button
        type="button"
        className="px-2 py-1 rounded border text-sm border-gray-400 text-gray-700 hover:bg-gray-50"
        onClick={() => setTraffic(5)}
      >
        🌪 Traffic surge
      </button>
    </div>
  );
}

export default ChaosControls;
