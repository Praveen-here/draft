/**
 * Gradium speech-to-text over WebSocket.
 * - Get a single-use token from /api/voice/token for every connection.
 * - Set delay_in_frames ≈ 8–16 (default 50 = 4 s lag, see docs/TEST_RESULTS.md).
 * - End of turn: last VAD horizon's inactivity_prob above ~0.5–0.7 for a few steps.
 */
export type SttStream = {
  send(audio: Float32Array): void;
  close(): void;
};

export async function openStt(onFinal: (text: string) => void): Promise<SttStream> {
  // TODO(C)
  void onFinal;
  return { send() {}, close() {} };
}
