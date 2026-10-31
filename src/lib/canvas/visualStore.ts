import type { ReactNode } from "react";
import type { BBox, Note } from "@/lib/contracts";

/**
 * What the tutor has put up for the current problem, in the order it arrived:
 * - node: a React visual. The lesson thread (Part C) floats as message bubbles beside the circle;
 *   every other node (Part D's graphs) goes in the graph panel.
 * - note: an explain card's mark on the page (a numbered outline round its term). The card itself is a
 *   bubble in the lesson thread.
 */
export type LessonItem =
  | { id: string; kind: "node"; node: ReactNode }
  | { id: string; kind: "note"; note: Note; anchor: BBox | null };

/** The lesson thread is mounted with this id; it floats beside the circle as bubbles. */
export const LESSON_CARD_ID = "lesson";

/** Screen space covered by floating UI (bars, ask pill), in CSS pixels; bubbles and panels stay clear of it. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };

/**
 * anchor: what the student circled, in page coordinates; the bubbles float around it.
 * gen goes up on every clear, so the last problem's bubbles can animate out while the new ones come in.
 */
export type LessonState = { anchor: BBox | null; items: LessonItem[]; gen: number; safe: SafeArea };

/** Tiny observable store for the current lesson, read by <TutorOverlay>. */
export function createVisualStore() {
  let state: LessonState = { anchor: null, items: [], gen: 0, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  const listeners = new Set<() => void>();
  const update = (next: Partial<LessonState>) => {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  };

  return {
    get: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    has: (id: string) => state.items.some((v) => v.id === id),
    setAnchor: (anchor: BBox | null) => update({ anchor }),
    setSafe: (safe: SafeArea) => update({ safe }),
    /** Add an item at the end, or replace it in place if the id exists (so it doesn't jump). */
    set(item: LessonItem) {
      const i = state.items.findIndex((v) => v.id === item.id);
      update({ items: i < 0 ? [...state.items, item] : state.items.map((v, j) => (j === i ? item : v)) });
    },
    remove(id: string) {
      update({ items: state.items.filter((v) => v.id !== id) });
    },
    clear() {
      if (!state.items.length && !state.anchor) return;
      update({ items: [], anchor: null, gen: state.gen + 1 });
    },
  };
}

export type VisualStore = ReturnType<typeof createVisualStore>;
