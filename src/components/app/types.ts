export type Paper = "blank" | "lined" | "grid" | "dots";

export const PAPERS: { id: Paper; label: string }[] = [
  { id: "blank", label: "Blank" },
  { id: "lined", label: "Lined" },
  { id: "grid", label: "Grid" },
  { id: "dots", label: "Dots" },
];

/** What the student chose on the start screen. */
export type DocSource = { kind: "blank"; paper: Paper } | { kind: "file"; file: File; paper: Paper };
