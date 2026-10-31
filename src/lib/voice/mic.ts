export type MicHandle = {
  /** Stop listening and release the microphone. */
  stop(): void;
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

type RecognitionCtor = new () => Recognition;

export function micSupported(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).webkitSpeechRecognition;
}

/**
 * Mic on (D15). Calls onTranscript with each finished sentence the student says.
 * TODO(C): Gradium STT over WebSocket (docs/APPROACH_DRAFT.md §5); this uses the browser's speech recognition.
 */
export async function startMic(onTranscript: (text: string) => void, onError?: (message: string) => void): Promise<MicHandle> {
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) {
    onError?.("Voice input isn't supported in this browser. Use Chrome or Edge, or type instead.");
    return { stop() {} };
  }

  let on = true;
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.continuous = true;
  rec.interimResults = false;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal && r[0].transcript.trim()) onTranscript(r[0].transcript.trim());
    }
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      on = false;
      onError?.("Microphone access was blocked. Allow it in the browser, or type instead.");
    }
  };
  // The browser stops after a pause; keep listening while the mic is on.
  rec.onend = () => {
    if (on) rec.start();
  };
  rec.start();

  return {
    stop() {
      on = false;
      rec.stop();
    },
  };
}
