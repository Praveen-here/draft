import type { ReactNode } from "react";
import type { BBox, Note } from "@/lib/contracts";

/**
 * One item in the lesson column beside the circled problem, top to bottom in the order the tutor added them:
 * - node: a React visual (the lesson card, Part D's graphs)
 * - note: an explain card, with a leader line to the term it explains (anchor, in page coordinates)
 * - step: one line the tutor writes in its handwriting
 */
export type LessonItem =
  | { id: string; kind: "node"; node: ReactNode }
  | { id: string; kind: "note"; note: Note; anchor: BBox | null }
  | { id: string; kind: "step"; text: string };

/** The lesson card (Part C) is mounted with this id; it is the only column item that takes touches. */
export const LESSON_CARD_ID = "lesson";

/**
 * Where the column starts, in page coordinates, and how wide it is. minY/maxY: the part of the page that
 * was on screen (not under the bars) when the lesson started; a tall column slides up to stay inside it.
 */
export type LessonColumn = { x: number; y: number; w: number; minY: number; maxY: number };

/** gen goes up on every clear, so the old column can animate out while the new one comes in. */
export type LessonState = { column: LessonColumn | null; items: LessonItem[]; gen: number };

/** Tiny observable store for the lesson column, read by <TutorOverlay>. */
export function createVisualStore() {
  let state: LessonState = { column: null, items: [], gen: 0 };
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
    setColumn: (column: LessonColumn | null) => update({ column }),
    /** Add an item at the bottom, or replace it in place if the id exists (so it doesn't jump). */
    set(item: LessonItem) {
      const i = state.items.findIndex((v) => v.id === item.id);
      update({ items: i < 0 ? [...state.items, item] : state.items.map((v, j) => (j === i ? item : v)) });
    },
    remove(id: string) {
      update({ items: state.items.filter((v) => v.id !== id) });
    },
    clear() {
      if (!state.items.length && !state.column) return;
      update({ items: [], column: null, gen: state.gen + 1 });
    },
  };
}

export type VisualStore = ReturnType<typeof createVisualStore>;
