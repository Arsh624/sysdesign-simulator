import { useEffect } from "react";
import Palette from "./ui/Palette";
import Canvas from "./canvas/Canvas";
import ControlBar from "./ui/ControlBar";
import Inspector from "./ui/Inspector";
import MetricsPanel from "./ui/MetricsPanel";
import ChaosControls from "./ui/ChaosControls";
import PresetPicker from "./ui/PresetPicker";
import SaveLoadControls from "./ui/SaveLoadControls";
import { initAutosave } from "./persistence/autosave";
import { loadAutosave } from "./persistence/storage";
import { useDesignStore } from "./store/designStore";

function App() {
  useEffect(() => {
    const saved = loadAutosave();
    if (saved && Array.isArray(saved.nodes) && saved.nodes.length) {
      useDesignStore.getState().loadDesign(saved as any);
    }

    const unsub = initAutosave();
    return () => unsub();
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-white text-gray-900">
      {/* LEFT: Palette */}
      <div className="w-64 shrink-0 border-r overflow-y-auto flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Components</h2>
        </div>
        <Palette />
      </div>

      {/* CENTER: Control bar + Canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        <ControlBar>
          <div className="flex items-center gap-3">
            <PresetPicker />
            <SaveLoadControls />
            <ChaosControls />
          </div>
        </ControlBar>
        <div className="flex-1 min-h-0">
          <Canvas />
        </div>
      </div>

      {/* RIGHT: Inspector + Metrics */}
      <div className="w-96 shrink-0 border-l overflow-y-auto flex flex-col">
        <div className="px-3 py-2 border-b">
          <h2 className="text-sm font-semibold text-gray-700">Inspector</h2>
        </div>
        <Inspector />
        <div className="border-t" />
        <MetricsPanel />
      </div>
    </div>
  );
}

export default App;
