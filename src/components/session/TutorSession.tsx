"use client";

// Lead-only: builds the real parts inside the canvas and connects them (src/lib/session.ts).

import { useEffect, useState } from "react";
import { useEditor } from "tldraw";
import { TutorOverlay } from "@/components/app/TutorOverlay";
import { createVisualsApi } from "@/components/visuals";
import { TutorPanel } from "@/components/voice";
import { createBrain } from "@/lib/agent";
import { createCanvasApi, type CanvasHandle } from "@/lib/canvas";
import type { BrainApi, PlayerApi } from "@/lib/contracts";
import { createMathApi } from "@/lib/math";
import { createPlayer } from "@/lib/player";
import { connect } from "@/lib/session";

type Parts = { canvas: CanvasHandle; brain: BrainApi; player: PlayerApi };

export function TutorSession() {
  const editor = useEditor();
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    const canvas = createCanvasApi(editor);
    const visuals = createVisualsApi(canvas);
    const brain = createBrain({ canvas, math: createMathApi() });
    const player = createPlayer({ canvas, visuals });
    const disconnect = connect({ canvas, brain, player });
    setParts({ canvas, brain, player });

    // Keep tutor items clear of the top bar, toolbar and the tutor panel (right side, or bottom on phones).
    const fit = () => {
      const wide = window.innerWidth >= 640;
      canvas.setSafeArea(
        wide
          ? { top: 80, right: 396, bottom: 96, left: 12 }
          : { top: 80, right: 0, bottom: Math.round(window.innerHeight * 0.46) + 96, left: 0 },
      );
    };
    fit();
    window.addEventListener("resize", fit);

    // Dev only: lets tests and the console reach the editor.
    if (process.env.NODE_ENV === "development") (window as unknown as { editor: unknown }).editor = editor;

    return () => {
      window.removeEventListener("resize", fit);
      disconnect();
      player.stop();
      canvas.dispose();
    };
  }, [editor]);

  if (!parts) return null;
  return (
    <>
      <TutorOverlay store={parts.canvas.visuals} />
      <TutorPanel canvas={parts.canvas} brain={parts.brain} player={parts.player} />
    </>
  );
}
