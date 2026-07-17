export interface PersistedDesign {
  nodes: unknown[];
  edges: unknown[];
}

const DESIGNS_KEY = "sds:designs";
const AUTOSAVE_KEY = "sds:autosave";

type DesignsMap = Record<string, PersistedDesign>;

function readDesignsMap(): DesignsMap {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as DesignsMap;
    return {};
  } catch {
    return {};
  }
}

function writeDesignsMap(map: DesignsMap): void {
  try {
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(map));
  } catch {
    // ignore write failures (e.g. quota exceeded, unavailable storage)
  }
}

export function saveDesign(name: string, design: PersistedDesign): void {
  const map = readDesignsMap();
  map[name] = design;
  writeDesignsMap(map);
}

export function listDesigns(): string[] {
  return Object.keys(readDesignsMap());
}

export function loadDesign(name: string): PersistedDesign | undefined {
  return readDesignsMap()[name];
}

export function deleteDesign(name: string): void {
  const map = readDesignsMap();
  delete map[name];
  writeDesignsMap(map);
}

export function autosave(design: PersistedDesign): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(design));
  } catch {
    // ignore write failures
  }
}

export function loadAutosave(): PersistedDesign | undefined {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as PersistedDesign;
    return undefined;
  } catch {
    return undefined;
  }
}

export function exportJSON(design: PersistedDesign): string {
  return JSON.stringify(design, null, 2);
}

export function importJSON(str: string): PersistedDesign {
  return JSON.parse(str) as PersistedDesign;
}
