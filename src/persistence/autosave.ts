import { useDesignStore } from "../store/designStore";
import { autosave } from "./storage";

const DEBOUNCE_MS = 500;

export function initAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = useDesignStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      autosave({ nodes: state.nodes, edges: state.edges });
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
