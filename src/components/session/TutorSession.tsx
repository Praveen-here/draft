"use client";

// Lead-only: builds the real parts inside the canvas and connects them (src/lib/session.ts).

import { createElement, useEffect, useState } from "react";
import { useEditor } from "tldraw";
import { TutorOverlay } from "@/components/app/TutorOverlay";
import { createVisualsApi } from "@/components/visuals";
import { AskBar, LessonCard } from "@/components/voice";
import { createBrain } from "@/lib/agent";
import { createCanvasApi, LESSON_CARD_ID, type CanvasHandle } from "@/lib/canvas";
import type { BrainApi, PlayerApi, Target } from "@/lib/contracts";
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
    // Every circle starts a lesson: its card goes first in the column beside the problem (cards follow).
    // A question asked with no lesson open (nothing circled yet) opens one too, before the brain answers.
    const lesson = (near: Target, asked?: string) =>
      canvas.mountVisual(LESSON_CARD_ID, near, createElement(LessonCard, { brain, player, asked }));
    const offCircle = canvas.onEvent((e) => {
      if (e.type === "circle") lesson({ bbox: e.context.bbox });
    });
    const offAsk = player.onStudentSaid((said) => {
      if (!canvas.visuals.has(LESSON_CARD_ID)) lesson({ bbox: { x: 0, y: 0, w: 0, h: 0 } }, said.transcript);
    });

    const disconnect = connect({ canvas, brain, player });
    setParts({ canvas, brain, player });

    // Keep tutor items clear of the top bar and the toolbar + ask bar at the bottom.
    const fit = () => canvas.setSafeArea({ top: 80, right: 12, bottom: 168, left: 12 });
    fit();
    window.addEventListener("resize", fit);

    // Dev only: lets tests and the console reach the editor.
    if (process.env.NODE_ENV === "development") (window as unknown as { editor: unknown }).editor = editor;

    return () => {
      window.removeEventListener("resize", fit);
      offCircle();
      offAsk();
      disconnect();
      player.stop();
      canvas.dispose();
    };
  }, [editor]);

  if (!parts) return null;
  return (
    <>
      <TutorOverlay store={parts.canvas.visuals} />
      <AskBar canvas={parts.canvas} brain={parts.brain} player={parts.player} />
    </>
  );
}
