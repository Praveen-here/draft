import type { BrainApi, CanvasApi, MathApi, TutorTurn } from "@/lib/contracts";
import { newStudentModel, type StudentModel } from "./studentModel";

type Deps = { canvas: CanvasApi; math: MathApi };

/**
 * The teaching loop (docs/AGENT_BRAIN.md §3):
 * understand → diagnose → explain → check → practice → verify → done, looping back to adapt.
 */
export function createBrain({ canvas, math }: Deps): BrainApi {
  const listeners = new Set<(turn: TutorTurn) => void>();
  let model: StudentModel = newStudentModel("untitled");

  const emit = (turn: TutorTurn) => listeners.forEach((fn) => fn(turn));

  return {
    handleCanvas(event) {
      // TODO(B): circle → understand; line → math.checkStep → triggers; idle → maybe nudge.
      void event;
      void canvas;
      void math;
      void emit;
    },
    handleSpeech(said) {
      // TODO(B): send transcript + circle + model to /api/tutor, stream beats back, emit turns.
      void said;
    },
    onTurn(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    reset() {
      model = newStudentModel("untitled");
      void model;
    },
  };
}
