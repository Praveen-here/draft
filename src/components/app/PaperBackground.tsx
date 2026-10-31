"use client";

import { useEditor, useValue } from "tldraw";
import type { CSSProperties } from "react";
import type { Paper } from "./types";

/** Spacing between lines/dots, in canvas units (scales with zoom). */
const SPACING: Record<Paper, number> = { blank: 0, lined: 34, grid: 26, dots: 24 };

const LINE = "rgba(60, 60, 67, 0.13)"; // Apple's separator grey, softened
const DOT = "rgba(60, 60, 67, 0.28)";

/**
 * Paper pattern drawn under the canvas. It follows the camera so lines stay
 * glued to the ink while panning and zooming.
 */
export function PaperBackground({ paper, tint }: { paper: Paper; tint: string }) {
  const editor = useEditor();
  const cam = useValue("camera", () => editor.getCamera(), [editor]);

  const style: CSSProperties = { position: "absolute", inset: 0, backgroundColor: tint };
  const gap = SPACING[paper] * cam.z;

  // Patterns fade out when zoomed far out, so the page never turns into noise.
  if (paper !== "blank" && gap >= 6) {
    const x = cam.x * cam.z;
    const y = cam.y * cam.z;

    if (paper === "lined") {
      style.backgroundImage = `linear-gradient(to bottom, transparent calc(100% - 1px), ${LINE} calc(100% - 1px))`;
      style.backgroundSize = `100% ${gap}px`;
      style.backgroundPosition = `0 ${y}px`;
    } else if (paper === "grid") {
      style.backgroundImage = `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`;
      style.backgroundSize = `${gap}px ${gap}px`;
      style.backgroundPosition = `${x}px ${y}px`;
    } else {
      const r = Math.max(0.8, Math.min(1.4, cam.z * 1.1));
      style.backgroundImage = `radial-gradient(circle, ${DOT} ${r}px, transparent ${r + 0.6}px)`;
      style.backgroundSize = `${gap}px ${gap}px`;
      style.backgroundPosition = `${x - gap / 2}px ${y - gap / 2}px`;
    }
  }

  return <div style={style} aria-hidden />;
}
