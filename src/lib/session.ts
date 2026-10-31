/**
 * Wires the four parts together. Lead-only file.
 * Each part is swapped from its fake to the real thing at the join steps in docs/AGENT_BRAIN.md §9.
 *
 *   canvas events ─► brain ─► turns ─► player ─► (canvas.draw / visuals.run)
 *   student speech ◄─────────────────── player
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
    canvas.onEvent((event) => brain.handleCanvas(event)),
    player.onStudentSaid((said) => {
      if (said.duringTurn) player.stop();
      brain.handleSpeech(said);
    }),
    brain.onTurn((turn) => void player.play(turn)),
  ];
  return () => offs.forEach((off) => off());
}
