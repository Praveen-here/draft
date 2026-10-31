"use client";

// Lead-only: builds the real parts on top of the canvas and connects them (src/lib/session.ts).

import { createElement, useEffect, useState } from "react";
import { useEditor } from "tldraw";
import { TutorOverlay } from "@/components/app/TutorOverlay";
import { createVisualsApi } from "@/components/visuals";
import { AskBar, LessonCard } from "@/components/voice";
import { createBrain } from "@/lib/agent";
import { LESSON_CARD_ID, type CanvasHandle } from "@/lib/canvas";
import type { BrainApi, PlayerApi, Target } from "@/lib/contracts";
import { createMathApi } from "@/lib/math";
import { createPlayer } from "@/lib/player";
import { connect } from "@/lib/session";

type Parts = { brain: BrainApi; player: PlayerApi };

/** @param canvas Part A's canvas API, created by <Canvas> when the editor mounts. */
export function TutorSession({ canvas }: { canvas: CanvasHandle }) {
  const editor = useEditor();
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    let player: PlayerApi | null = null;
    // Grabbing a graph (dragging its point or a slider) stops the tutor talking over it.
    const visuals = createVisualsApi(canvas, {
      onInteraction: () => player?.stop(),
      onError: (message) => console.warn("Visual request:", message),
    });
    const brain = createBrain({ canvas, math: createMathApi() });
    player = createPlayer({ canvas, visuals });
    const play = player;

    // Every circle starts a lesson: its card goes first in the column beside the problem (cards follow).
    // A question asked with no lesson open (nothing circled yet) opens one too, before the brain answers.
    const lesson = (near: Target, asked?: string) =>
      canvas.mountVisual(LESSON_CARD_ID, near, createElement(LessonCard, { brain, player: play, asked }));
    const offCircle = canvas.onEvent((e) => {
      if (e.type === "circle") lesson({ bbox: e.context.bbox });
    });
    const offAsk = play.onStudentSaid((said) => {
      if (!canvas.visuals.has(LESSON_CARD_ID)) lesson({ bbox: { x: 0, y: 0, w: 0, h: 0 } }, said.transcript);
    });
    // Barge-in also freezes any value that is sliding on a graph.
    const offStop = play.onStudentSaid((said) => {
      if (said.duringTurn) visuals.stop();
    });

    const disconnect = connect({ canvas, brain, player: play });
    setParts({ brain, player: play });

    // Keep tutor items clear of the top bar + Layers button and the toolbar + ask bar at the bottom.
    const fit = () => canvas.setSafeArea({ top: 136, right: 12, bottom: 168, left: 12 });
    fit();
    window.addEventListener("resize", fit);

    // Dev only: lets tests and the console reach the editor.
    if (process.env.NODE_ENV === "development") (window as unknown as { editor: unknown }).editor = editor;

    return () => {
      window.removeEventListener("resize", fit);
      offCircle();
      offAsk();
      offStop();
      disconnect();
      play.stop();
      visuals.dispose();
    };
  }, [canvas, editor]);

  if (!parts) return null;
  return (
    <>
      <TutorOverlay store={canvas.visuals} />
      <AskBar canvas={canvas} brain={parts.brain} player={parts.player} />
    </>
  );
}
