import type { SavedCanvas } from "@/lib/docs";

export type Paper = "blank" | "lined" | "grid" | "dots";

export const PAPERS: { id: Paper; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "lined", label: "Lined" },
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
];

/** A saved document this canvas belongs to: saving goes there, and `saved` is what to put back on open. */
export type OpenDoc = { id: string; title: string; saved?: { canvas: SavedCanvas | null; chat: unknown[] } };

/** What the student chose on the start screen (doc: where it's saved; absent when saving is off). */
export type DocSource =
  | { kind: "blank"; paper: Paper; doc?: OpenDoc }
  | { kind: "file"; file: File; paper: Paper; doc?: OpenDoc };
