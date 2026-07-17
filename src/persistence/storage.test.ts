import { it, expect, beforeEach } from "vitest";
import { saveDesign, listDesigns, loadDesign, deleteDesign, exportJSON, importJSON } from "./storage";

beforeEach(() => localStorage.clear());

it("saves, lists, and loads a named design", () => {
  const design = { nodes: [{ id: "n1" }], edges: [] } as any;
  saveDesign("my-app", design);
  expect(listDesigns()).toContain("my-app");
  expect(loadDesign("my-app")).toEqual(design);
});

it("deletes a named design", () => {
  saveDesign("temp", { nodes: [], edges: [] } as any);
  deleteDesign("temp");
  expect(listDesigns()).not.toContain("temp");
});

it("round-trips through export/import JSON", () => {
  const design = { nodes: [{ id: "n1" }], edges: [] } as any;
  const json = exportJSON(design);
  expect(importJSON(json)).toEqual(design);
});
