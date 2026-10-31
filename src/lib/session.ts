/**
 * Wires the four parts together. Lead-only file.
 *
 *   canvas events ─► brain ─► turns ─► player ─► (canvas.draw / visuals.run)
 *   student speech/text ─► player.say ─► brain
 */

import type { BrainApi, CanvasApi, PlayerApi } from "./contracts";

export type Session = {
  canvas: CanvasApi;
  brain: BrainApi;
  player: PlayerApi;
};

/** Connects the parts. Returns a function that disconnects them. */
export function connect({ canvas, brain, player }: Session): () => void {
  const offs = [
    canvas.onEvent((event) => {
      if (event.type === "circle") player.stop(); // a new circle = a new question
      brain.handleCanvas(event);
    }),
    player.onStudentSaid((said) => {
      if (said.duringTurn) player.stop(); // barge-in: the student talks over the tutor
      brain.handleSpeech(said);
    }),
    brain.onTurn((turn) => void player.play(turn)),
  ];
  return () => offs.forEach((off) => off());
}
