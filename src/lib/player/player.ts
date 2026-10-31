import type { CanvasApi, PlayerApi, StudentSaid, TutorTurn, VisualAction, VisualsApi } from "@/lib/contracts";
import { speak, type Speech } from "@/lib/voice";

type Deps = { canvas: CanvasApi; visuals: VisualsApi };

const BEAT_GAP_MS = 180;

/** Plays turns beat by beat, firing each beat's visuals as its sentence starts (D21). */
export function createPlayer({ canvas, visuals }: Deps): PlayerApi {
  const saidListeners = new Set<(said: StudentSaid) => void>();
  const beatListeners = new Set<(turn: TutorTurn, index: number | null) => void>();
  let current: Speech | null = null;
  let playing = 0; // id of the turn being played; 0 = none

  const fire = (action: VisualAction) => {
    if (action.type === "highlight" || action.type === "writeStep" || action.type === "mark" || action.type === "note") canvas.draw(action);
    else visuals.run(action);
  };
  const beat = (turn: TutorTurn, index: number | null) => beatListeners.forEach((fn) => fn(turn, index));

  let nextId = 0;
  return {
    async play(turn) {
      const id = ++nextId;
      current?.cancel();
      playing = id;
      for (let i = 0; i < turn.beats.length; i++) {
        if (playing !== id) return;
        const b = turn.beats[i];
        current = speak(b.say);
        await current.started;
        if (playing !== id) return;
        beat(turn, i);
        b.visuals.forEach(fire);
        await current.ended;
        await new Promise((r) => setTimeout(r, BEAT_GAP_MS));
      }
      if (playing !== id) return;
      playing = 0;
      current = null;
      beat(turn, null);
    },
    stop() {
      playing = 0;
      current?.cancel();
      current = null;
    },
    onStudentSaid(listener) {
      saidListeners.add(listener);
      return () => void saidListeners.delete(listener);
    },
    onBeat(listener) {
      beatListeners.add(listener);
      return () => void beatListeners.delete(listener);
    },
    say(transcript) {
      const said: StudentSaid = { transcript, duringTurn: playing !== 0 };
      saidListeners.forEach((fn) => fn(said));
    },
  };
}
