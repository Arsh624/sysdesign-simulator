// Drag-and-drop helpers for dragging components from the palette onto the canvas.
import type React from "react";

export const DND_MIME = "application/x-sds-component";

export function onPaletteDragStart(e: React.DragEvent, componentId: string): void {
  e.dataTransfer.setData(DND_MIME, componentId);
  e.dataTransfer.effectAllowed = "move";
}

export function readDraggedComponent(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(DND_MIME) || null;
}
