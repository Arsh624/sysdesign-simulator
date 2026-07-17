import { useDesignStore } from "../store/designStore";
import { autosave } from "./storage";

const DEBOUNCE_MS = 500;

export function initAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useDesignStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const cleanNodes = state.nodes.map((n) => ({
        ...n,
        data: { ...n.data, utilization: 0, queueDepth: 0, crashed: false, rps: 0, p95: 0 },
      }));
      autosave({ nodes: cleanNodes, edges: state.edges });
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
