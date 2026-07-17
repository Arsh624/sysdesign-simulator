import { CATALOG } from "../palette/catalog";
import type { Category } from "../palette/types";
import { onPaletteDragStart } from "../canvas/dnd";

const CATEGORY_ORDER: Category[] = [
  "Client",
  "Traffic & Edge",
  "Compute",
  "Storage",
  "Messaging",
  "Observability",
  "Network",
  "AI & Agents",
  "External",
];

export function Palette() {
  const byCategory = new Map<Category, typeof CATALOG>();
  for (const c of CATALOG) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  const orderedCategories = CATEGORY_ORDER.filter((cat) => byCategory.has(cat));

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-50 border-r border-gray-200 p-2">
      {orderedCategories.map((category) => (
        <details key={category} open className="mb-2">
          <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-gray-500 px-1 py-1">
            {category}
          </summary>
          <div className="flex flex-col">
            {byCategory.get(category)!.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={(e) => onPaletteDragStart(e, c.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab select-none hover:bg-gray-200 active:cursor-grabbing text-sm text-gray-800"
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default Palette;
