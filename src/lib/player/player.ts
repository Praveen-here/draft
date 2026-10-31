import type { CanvasApi, PlayerApi, StudentSaid, VisualAction, VisualsApi } from "@/lib/contracts";
import { speak, type Speech } from "@/lib/voice";

type Deps = { canvas: CanvasApi; visuals: VisualsApi };

/** Plays turns beat by beat, firing each beat's visuals as its sentence starts. */
export function createPlayer({ canvas, visuals }: Deps): PlayerApi {
  const listeners = new Set<(said: StudentSaid) => void>();
  let current: Speech | null = null;
  let stopped = false;

  const fire = (action: VisualAction) => {
    if (action.type === "highlight" || action.type === "writeStep" || action.type === "mark") canvas.draw(action);
    else visuals.run(action);
  };

  return {
    async play(turn) {
      stopped = false;
      for (const beat of turn.beats) {
        if (stopped) return;
        current = speak(beat.say);
        await current.started;
        beat.visuals.forEach(fire);
        await current.ended;
      }
      current = null;
      // TODO(C): handle turn.waitFor (open the mic for "answer", wait for the pen for "line").
    },
    stop() {
      stopped = true;
      current?.cancel();
      current = null;
    },
    onStudentSaid(listener) {
      // TODO(C): call listeners from the mic/STT with { transcript, duringTurn: current !== null }.
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
