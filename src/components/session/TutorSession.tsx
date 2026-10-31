"use client";

// Lead-only: builds the real parts on top of the canvas and connects them (src/lib/session.ts).

import { createElement, useEffect, useState } from "react";
import { useEditor } from "tldraw";
import { TutorOverlay } from "@/components/app/TutorOverlay";
import { createVisualsApi } from "@/components/visuals";
import { AskBar, LessonCard, problemLabel } from "@/components/voice";
import { createBrain } from "@/lib/agent";
import type { OpenDoc } from "@/components/app/types";
import { LESSON_CARD_ID, type CanvasHandle } from "@/lib/canvas";
import type { BrainApi, PlayerApi, VisualAction } from "@/lib/contracts";
import { autosaver } from "@/lib/docs";
import { createMathApi } from "@/lib/math";
import { createPlayer } from "@/lib/player";
import { connect } from "@/lib/session";

type Parts = { brain: BrainApi; player: PlayerApi };

/**
 * @param canvas Part A's canvas API, created by <Canvas> when the editor mounts.
 * @param doc the saved document, if any: its conversation comes back on open, and every change to it is saved.
 */
export function TutorSession({ canvas, doc }: { canvas: CanvasHandle; doc?: OpenDoc }) {
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

    // One conversation per document: it opens with the first circle (or question) and is never cleared.
    // Each new circle adds a "new question" divider to it (LessonCard) and the thread moves beside that circle.
    // The conversation is saved with the document, a moment after each change.
    let chat: unknown[] = [];
    // Each explain card is saved with where its mark ended up on the page (snapped onto the printed term), so
    // a reopened document puts the mark back on the same spot, without the circle that guided the snapping.
    const placed = () => {
      const anchors = new Map(canvas.visuals.get().items.flatMap((i) => (i.kind === "note" && i.anchor ? [[i.id, i.anchor] as const] : [])));
      return chat.map((m) => {
        const msg = m as { from?: string; turn?: { beats?: { visuals?: VisualAction[] }[] } };
        if (msg.from !== "tutor" || !msg.turn?.beats) return m;
        return { ...msg, turn: { ...msg.turn, beats: msg.turn.beats.map((b) => ({ ...b, visuals: (b.visuals ?? []).map((v) => {
          const at = v.type === "note" ? anchors.get(`note:${v.id}`) : undefined;
          return at && v.type === "note" ? { ...v, target: { bbox: at } } : v;
        }) })) } };
      });
    };
    const chatSaver = doc ? autosaver(doc.id, () => ({ chat: placed() }), 800) : null;
    const onChange = (msgs: unknown[]) => { chat = msgs; chatSaver?.schedule(); };
    const lesson = (asked?: string, problem?: string, saved?: unknown[]) =>
      canvas.mountVisual(LESSON_CARD_ID, { bbox: { x: 0, y: 0, w: 0, h: 0 } },
        createElement(LessonCard, { brain, player: play, canvas, asked, problem, saved, onChange }));

    // A reopened document: its conversation comes back, with its graphs and the numbered marks on the page.
    // (Highlights and ticks are canvas shapes, restored with the ink.)
    const savedChat = doc?.saved?.chat ?? [];
    if (savedChat.length) {
      lesson(undefined, undefined, savedChat);
      for (const v of savedVisuals(savedChat)) {
        try {
          if (v.type === "note") canvas.draw(v);
          else if (v.type === "plot" || v.type === "showVisual") visuals.run(v);
          else if (v.type === "animateParam") visuals.run({ ...v, ms: 0 }); // straight to where it ended
        } catch { /* one bad visual mustn't stop the rest */ }
      }
    }
    // A hidden chat comes back when there's something new in it.
    const showChat = () => window.dispatchEvent(new Event("draft:show-chat"));
    const offCircle = canvas.onEvent((e) => {
      if (e.type !== "circle") return;
      if (!canvas.visuals.has(LESSON_CARD_ID)) lesson(undefined, problemLabel(e.context));
      showChat();
    });
    const offAsk = play.onStudentSaid((said) => {
      if (!canvas.visuals.has(LESSON_CARD_ID)) lesson(said.transcript);
      showChat();
    });
    const offSolved = brain.onTurn(showChat);
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
      void chatSaver?.flush();
      window.removeEventListener("resize", fit);
      offSolved();
      offCircle();
      offAsk();
      offStop();
      disconnect();
      play.stop();
      visuals.dispose();
    };
  }, [canvas, editor, doc]);

  if (!parts) return null;
  return (
    <>
      <TutorOverlay store={canvas.visuals} />
      <AskBar canvas={canvas} brain={parts.brain} player={parts.player} />
    </>
  );
}

/** Every visual of every tutor turn in a saved conversation, in order. */
function savedVisuals(msgs: unknown[]): VisualAction[] {
  const out: VisualAction[] = [];
  for (const m of msgs) {
    const turn = (m as { from?: string; turn?: { beats?: { visuals?: VisualAction[] }[] } }).from === "tutor"
      ? (m as { turn?: { beats?: { visuals?: VisualAction[] }[] } }).turn : undefined;
    for (const beat of turn?.beats ?? []) out.push(...(beat.visuals ?? []));
  }
  return out;
}
