import type { NoteKind } from "@/lib/contracts";

/**
 * Colour and label for each kind of explain card, used by the numbered marks on the page.
 * The lesson thread's note bubbles (Part C) use the same colours: keep the two in step.
 */
export const NOTE_TONE: Record<NoteKind, { colour: string; wash: string; label: string }> = {
  variable: { colour: "#2547d0", wash: "#eef2fd", label: "Variable" },
  number: { colour: "#168a52", wash: "#e8f6ee", label: "Number" },
  rule: { colour: "#6e4bd8", wash: "#f1edfd", label: "Rule" },
  mistake: { colour: "#d4452f", wash: "#fdeeeb", label: "Check this" },
};
