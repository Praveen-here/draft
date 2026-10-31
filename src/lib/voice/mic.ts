export type MicHandle = {
  /** Stop listening and release the microphone. */
  stop(): void;
};

/**
 * Mic on (D15): capture audio, run local VAD, stream speech to STT.
 * Calls onTranscript with each final transcript.
 */
export async function startMic(onTranscript: (text: string) => void): Promise<MicHandle> {
  // TODO(C): getUserMedia → VAD (@ricky0123/vad-web) → stt.ts
  void onTranscript;
  return { stop() {} };
}
