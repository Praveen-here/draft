import type { Editor } from "tldraw";
import type { BBox } from "@/lib/contracts";

/**
 * The student's handwriting in a region (or the latest lines) as LaTeX.
 * Plan: export an ink-only PNG of the region, send it to a server route that asks Gemini vision.
 */
export async function readInk(editor: Editor, region?: BBox): Promise<string[]> {
  // TODO(A)
  void editor;
  void region;
  return [];
}
