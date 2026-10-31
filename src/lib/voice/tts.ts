/** One spoken sentence. `started` resolves when audio begins (fire visuals then), `ended` when it finishes. */
export type Speech = {
  started: Promise<void>;
  ended: Promise<void>;
  cancel(): void;
};

/** Voices that sound natural, best first. Falls back to any English voice. */
const PREFERRED = [/Aria.*Online/i, /Jenny.*Online/i, /Neerja.*Online/i, /Google UK English Female/i, /Samantha/i, /Google US English/i, /Microsoft.*Natural/i];

let chosen: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (chosen !== undefined) return chosen;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null; // not loaded yet; try again next sentence
  chosen = PREFERRED.map((re) => voices.find((v) => re.test(v.name))).find(Boolean) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  return chosen;
}

/**
 * Speak one sentence. TODO(C): Gradium TTS (docs/APPROACH_DRAFT.md §5); this uses the browser's voice.
 * Timers back up the events, so a silent or blocked voice never stalls the lesson.
 */
export function speak(text: string): Speech {
  const estimateMs = 900 + text.split(/\s+/).length * 330;
  let resolveStart!: () => void;
  let resolveEnd!: () => void;
  const started = new Promise<void>((r) => (resolveStart = r));
  const ended = new Promise<void>((r) => (resolveEnd = r));
  const startTimer = setTimeout(resolveStart, 1200);
  const endTimer = setTimeout(resolveEnd, estimateMs * 1.3 + 1000);
  const finish = () => {
    clearTimeout(startTimer);
    clearTimeout(endTimer);
    resolveStart();
    resolveEnd();
  };

  if (typeof speechSynthesis === "undefined") {
    clearTimeout(endTimer);
    setTimeout(resolveEnd, estimateMs);
    return { started, ended, cancel: finish };
  }

  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 1.02;
  u.addEventListener("start", () => {
    clearTimeout(startTimer);
    resolveStart();
  });
  u.addEventListener("end", finish);
  u.addEventListener("error", finish);
  speechSynthesis.speak(u);

  return {
    started,
    ended,
    cancel() {
      speechSynthesis.cancel();
      finish();
    },
  };
}
