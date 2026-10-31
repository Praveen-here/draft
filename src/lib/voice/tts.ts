/** One spoken sentence. `started` resolves when audio begins (fire visuals then), `ended` when it finishes. */
export type Speech = {
  started: Promise<void>;
  ended: Promise<void>;
  cancel(): void;
};

/** Speak one sentence. TODO(C): Gradium TTS; this uses the browser's voice as a placeholder/fallback. */
export function speak(text: string): Speech {
  const u = new SpeechSynthesisUtterance(text);
  const started = new Promise<void>((resolve) => {
    u.addEventListener("start", () => resolve());
    u.addEventListener("error", () => resolve());
  });
  const ended = new Promise<void>((resolve) => {
    u.addEventListener("end", () => resolve());
    u.addEventListener("error", () => resolve());
  });
  speechSynthesis.speak(u);
  return { started, ended, cancel: () => speechSynthesis.cancel() };
}
