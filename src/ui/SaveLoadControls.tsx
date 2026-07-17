import { useRef, useState } from "react";
import { useDesignStore } from "../store/designStore";
import {
  saveDesign,
  listDesigns,
  loadDesign,
  exportJSON,
  importJSON,
} from "../persistence/storage";

function currentGraph() {
  const { nodes, edges } = useDesignStore.getState();
  return { nodes, edges };
}

export default function SaveLoadControls() {
  const [designNames, setDesignNames] = useState<string[]>(() => listDesigns());
  const [selected, setSelected] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDesignNames = () => setDesignNames(listDesigns());

  const handleSave = () => {
    const name = prompt("Design name:");
    if (name) {
      saveDesign(name, currentGraph() as any);
      refreshDesignNames();
    }
  };

  const handleLoadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    const d = loadDesign(name);
    if (d) {
      useDesignStore.getState().loadDesign(d as any);
    }
    setSelected(name);
  };

  const handleExport = () => {
    const json = exportJSON(currentGraph() as any);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "design.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = importJSON(text);
      useDesignStore.getState().loadDesign(parsed as any);
    } catch {
      alert("Failed to import design: invalid JSON");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="px-2 py-1 rounded border text-sm"
        onClick={handleSave}
      >
        💾 Save
      </button>

      <select
        className="px-2 py-1 rounded border text-sm"
        value={selected}
        onFocus={refreshDesignNames}
        onClick={refreshDesignNames}
        onChange={handleLoadChange}
      >
        <option value="" disabled>
          📂 Load…
        </option>
        {designNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="px-2 py-1 rounded border text-sm"
        onClick={handleExport}
      >
        ⬇ Export
      </button>

      <button
        type="button"
        className="px-2 py-1 rounded border text-sm"
        onClick={handleImportClick}
      >
        ⬆ Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
