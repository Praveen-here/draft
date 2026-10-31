/**
 * Fake versions of every part's API, so each part can be built and tested alone.
 * Lead-only file. Use these until the real part is ready (docs/AGENT_BRAIN.md §9).
 */

import type {
  BrainApi,
  CanvasApi,
  CanvasEvent,
  CircleContext,
  MathApi,
  PlayerApi,
  StudentSaid,
  TutorTurn,
  VisualsApi,
} from "./contracts";

const log = (part: string, ...args: unknown[]) => console.log(`[fake ${part}]`, ...args);

/** Simple listener set: add returns an unsubscribe function. */
function listeners<T>() {
  const set = new Set<(value: T) => void>();
  return {
    add(fn: (value: T) => void) {
      set.add(fn);
      return () => void set.delete(fn);
    },
    emit(value: T) {
      set.forEach((fn) => fn(value));
    },
  };
}

/** The demo problem, as if the student circled it. */
export const sampleCircle: CircleContext = {
  cropImage: "",
  inkOnlyImage: "",
  pdfText: "∫ x·eˣ dx",
  bbox: { x: 100, y: 120, w: 260, h: 80 },
  pageNo: 1,
  recentLines: ["\\int x e^x \\, dx"],
};

/** A hard-coded turn: lets Part C build the player before the brain exists. */
export const sampleTurn: TutorTurn = {
  beats: [
    {
      say: "Look at the two parts: x and e to the x.",
      visuals: [
        { type: "highlight", target: { bbox: { x: 130, y: 130, w: 30, h: 40 } }, colour: "blue" },
        { type: "highlight", target: { bbox: { x: 170, y: 130, w: 40, h: 40 } }, colour: "green" },
      ],
    },
    {
      say: "Watch what happens when we differentiate x. It becomes just one.",
      visuals: [{ type: "writeStep", text: "x → 1", near: { bbox: sampleCircle.bbox } }],
    },
    {
      say: "So which one should be u?",
      visuals: [],
    },
  ],
  waitFor: "answer",
  question: "Which one should be u?",
};

/** Fake canvas (Part A): fire events yourself with `emit`. */
export function fakeCanvas(): CanvasApi & { emit(event: CanvasEvent): void } {
  const events = listeners<CanvasEvent>();
  return {
    onEvent: events.add,
    emit: events.emit,
    getLatestCircle: () => sampleCircle,
    readInk: async () => sampleCircle.recentLines,
    draw: (action) => log("canvas", "draw", action),
    clearTutorInk: () => log("canvas", "clearTutorInk"),
    mountVisual: (id, near) => log("canvas", "mountVisual", id, near),
    unmountVisual: (id) => log("canvas", "unmountVisual", id),
  };
}

/** Fake brain (Part B): always answers with `sampleTurn`. */
export function fakeBrain(): BrainApi {
  const turns = listeners<TutorTurn>();
  const respond = () => setTimeout(() => turns.emit(sampleTurn), 300);
  return {
    handleCanvas: (event) => {
      log("brain", "canvas event", event);
      if (event.type === "circle") respond();
    },
    handleSpeech: (said) => {
      log("brain", "heard", said);
      respond();
    },
    onTurn: turns.add,
    onStatus: () => () => {},
    reset: () => log("brain", "reset"),
  };
}

/** Fake player (Part C): prints beats instead of speaking. Fire speech with `emit`. */
export function fakePlayer(): PlayerApi & { emit(said: StudentSaid): void } {
  const said = listeners<StudentSaid>();
  return {
    play: async (turn) => {
      for (const beat of turn.beats) log("player", "says:", beat.say, beat.visuals);
      if (turn.question) log("player", "waiting for:", turn.waitFor, turn.question);
    },
    stop: () => log("player", "stop"),
    onStudentSaid: said.add,
    onBeat: () => () => {},
    say: (transcript) => said.emit({ transcript, duringTurn: false }),
    emit: said.emit,
  };
}

/** Fake math engine (Part D): says every step is fine. */
export function fakeMath(): MathApi {
  return {
    checkStep: async (prev, next) => (log("math", "checkStep", prev, next), { ok: true }),
    checkAnswer: async (problem, answer) => (log("math", "checkAnswer", problem, answer), { ok: true }),
  };
}

/** Fake visuals (Part D): prints the action. */
export function fakeVisuals(): VisualsApi {
  return { run: (action) => log("visuals", "run", action) };
}
