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

/** What an explain card is about: a letter, a number, a rule, or a mistake in the student's work. */
export type NoteKind = "variable" | "number" | "rule" | "mistake";

/**
 * An explain card beside the problem, pointing at one term on the page.
 * E.g. title "u = x", text "x gets simpler when you differentiate it: x → 1". Same id = update.
 */
export type Note = { id: string; kind: NoteKind; title: string; text: string; target: Target | null };

export type VisualAction =
  | { type: "highlight"; target: Target; colour: InkColour }
  | ({ type: "note" } & Note)
  | { type: "writeStep"; text: string; near: Target } // one short line, unicode math (e.g. "x → 1")
  | { type: "mark"; target: Target; kind: "tick" | "cross" | "circle" }
  | { type: "plot"; id: string; fn: string; xRange: [number, number]; yRange?: [number, number]; params?: Record<string, number>; near: Target }
  | { type: "animateParam"; plotId: string; param: string; from: number; to: number; ms: number }
  | { type: "showVisual"; kind: "tangent" | "area" | "numberLine" | "table"; args: Record<string, unknown>; near: Target };

/** One spoken sentence plus the visuals that happen while it is said. */
export type Beat = {
  say: string;
  visuals: VisualAction[];
};

/** What the brain understood about the question (shown in the panel, useful for debugging). */
export type TurnInsight = {
  kind: "next-step" | "why" | "meaning" | "check" | "show" | "answer" | "other";
  /** One line: the exact doubt, e.g. "doesn't know which part to call u". */
  doubt: string;
  /** How the student's last message went. */
  studentWas: "asking" | "correct" | "partly" | "wrong" | "unsure" | "claims-understood";
  done: boolean;
  /** Which Gemini model answered and how long it took. */
  model?: string;
  ms?: number;
};

/** One teaching turn from the brain. */
export type TutorTurn = {
  beats: Beat[];
  /** What happens after the last beat. */
  waitFor: "answer" | "line" | "none";
  /** The question asked, when waitFor = "answer". */
  question?: string;
  insight?: TurnInsight;
};

export type BrainStatus = { state: "idle" } | { state: "thinking" } | { state: "error"; message: string };

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
  /** "thinking" while waiting for Gemini; "error" if every model failed. */
  onStatus(listener: (status: BrainStatus) => void): () => void;
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
  /** Draw a canvas-side visual (highlight, writeStep, mark, note). Plots go to Part D. */
  draw(action: Extract<VisualAction, { type: "highlight" | "writeStep" | "mark" | "note" }>): void;
  /** Remove every tutor shape and card (e.g. a new problem). */
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
  /** Which beat of which turn is playing now (index null = finished). For captions. */
  onBeat(listener: (turn: TutorTurn, index: number | null) => void): () => void;
  /** Hand a final transcript from the mic / text box to the listeners. */
  say(transcript: string): void;
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
