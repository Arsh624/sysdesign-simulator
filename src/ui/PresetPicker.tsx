import { useState } from "react";
import { PRESETS, getPresetById } from "../presets";
import { useDesignStore } from "../store/designStore";

export default function PresetPicker() {
  const [value, setValue] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const graph = getPresetById(id);
    if (graph) {
      useDesignStore.getState().loadDesign(graph);
    }
    setValue("");
  };

  return (
    <select
      className="text-sm border rounded px-2 py-1"
      value={value}
      onChange={handleChange}
    >
      <option value="" disabled>
        Load preset…
      </option>
      {PRESETS.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
    </select>
  );
}
