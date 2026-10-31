import type { ReactNode } from "react";

/** A React visual (e.g. a graph) pinned to a spot on the canvas, in page coordinates. */
export type PinnedVisual = { id: string; x: number; y: number; w: number; h: number; node: ReactNode };

/** Tiny observable list of pinned visuals, read by <TutorOverlay>. */
export function createVisualStore() {
  let items: PinnedVisual[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  return {
    get: () => items,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    has: (id: string) => items.some((v) => v.id === id),
    set(item: PinnedVisual) {
      items = [...items.filter((v) => v.id !== item.id), item];
      notify();
    },
    remove(id: string) {
      items = items.filter((v) => v.id !== id);
      notify();
    },
    clear() {
      items = [];
      notify();
    },
  };
}

export type VisualStore = ReturnType<typeof createVisualStore>;
