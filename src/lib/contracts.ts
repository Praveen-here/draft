/**
 * Shared data shapes between the four parts. The ONLY file parts import from each other.
 * Spec: docs/AGENT_BRAIN.md §7. Lead-only: ask the lead before changing anything here.
 */

import type { ReactNode } from "react";

/* ───────────── Geometry ───────────── */

/** A box in canvas (page) coordinates. */
export type BBox = { x: number; y: number; w: number; h: number };

/** Where on the canvas something points at: a box, or an existing tldraw shape. */
export type Target = { bbox: BBox } | { shapeId: string };

/* ───────────── Canvas (Part A) → Brain (Part B) ───────────── */

/** Everything the brain needs about the area the student circled. */
export type CircleContext = {
  /** PNG data URL: PDF + ink inside the circle. */
  cropImage: string;
  /** PNG data URL: only the student's ink inside the circle. */
  inkOnlyImage: string;
  /** Printed PDF text inside the circle ("" on blank documents). */
  pdfText: string;
  bbox: BBox;
  /** 1-based page number; 0 on blank documents. */
  pageNo: number;
  /** The last few recognised lines near the circle, as LaTeX, oldest first. */
  recentLines: string[];
};

export type CanvasEvent =
  | { type: "circle"; context: CircleContext }
  | { type: "line"; latex: string; target: Target }
  | { type: "idle"; ms: number };

/* ───────────── Voice (Part C) → Brain (Part B) ───────────── */

export type StudentSaid = {
  transcript: string;
  /** True if the student spoke while the tutor was talking (barge-in). */
  duringTurn: boolean;
};

/* ───────────── Brain (Part B) → Player (Part C) + Canvas (A) + Visuals (D) ───────────── */

export type InkColour = "blue" | "green" | "red";

export type VisualAction =
  | { type: "highlight"; target: Target; colour: InkColour }
  | { type: "writeStep"; latex: string; near: Target }
  | { type: "mark"; target: Target; kind: "tick" | "cross" | "circle" }
  | { type: "plot"; id: string; fn: string; xRange: [number, number]; params?: Record<string, number>; near: Target }
  | { type: "animateParam"; plotId: string; param: string; from: number; to: number; ms: number }
  | { type: "showVisual"; kind: "tangent" | "area" | "numberLine" | "table"; args: Record<string, unknown>; near: Target };

/** One spoken sentence plus the visuals that happen while it is said. */
export type Beat = {
  say: string;
  visuals: VisualAction[];
};

/** One teaching turn from the brain. */
export type TutorTurn = {
  beats: Beat[];
  /** What happens after the last beat. */
  waitFor: "answer" | "line" | "none";
  /** The question asked, when waitFor = "answer". */
  question?: string;
};

/* ───────────── Math engine (Part D) ───────────── */

export type StepCheck =
  | { ok: true }
  | { ok: false; reason: "not-equivalent" | "unparseable" | "unsure"; detail?: string };

/* ───────────── Interfaces each part provides ───────────── */
// Wired together in src/lib/session.ts (lead). For testing alone, use src/lib/fakes.ts.

/** Part B provides this: takes in what happened, sends out teaching turns. */
export interface BrainApi {
  handleCanvas(event: CanvasEvent): void;
  handleSpeech(said: StudentSaid): void;
  /** Subscribe to turns the brain wants played. Returns an unsubscribe function. */
  onTurn(listener: (turn: TutorTurn) => void): () => void;
  /** Start fresh on a new problem / document. */
  reset(): void;
}

/** Part A provides this to the rest of the app. */
export interface CanvasApi {
  /** Subscribe to circles, new lines and idle time. Returns an unsubscribe function. */
  onEvent(listener: (event: CanvasEvent) => void): () => void;
  getLatestCircle(): CircleContext | null;
  /** The student's handwriting in a region (or the latest lines) as LaTeX. */
  readInk(region?: BBox): Promise<string[]>;
  /** Draw a canvas-side visual (highlight, writeStep, mark). Plots go to Part D. */
  draw(action: Extract<VisualAction, { type: "highlight" | "writeStep" | "mark" }>): void;
  /** Remove every tutor shape (e.g. "hide tutor ink"). */
  clearTutorInk(): void;
  /** Place a React visual (e.g. Part D's graph) on the canvas near a target. Same id = replace. */
  mountVisual(id: string, near: Target, node: ReactNode): void;
  unmountVisual(id: string): void;
}

/** Part C provides this: plays turns and reports what the student said. */
export interface PlayerApi {
  play(turn: TutorTurn): Promise<void>;
  /** Stop speaking and drop queued beats (barge-in). */
  stop(): void;
  onStudentSaid(listener: (said: StudentSaid) => void): () => void;
}

/** Part D provides this: checks math. */
export interface MathApi {
  checkStep(prevLatex: string, nextLatex: string): Promise<StepCheck>;
  checkAnswer(problemLatex: string, answerLatex: string): Promise<StepCheck>;
}

/** Part D provides this: graph-side visuals, placed on the canvas by Part A. */
export interface VisualsApi {
  run(action: Extract<VisualAction, { type: "plot" | "animateParam" | "showVisual" }>): void;
}
