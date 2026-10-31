"use client";

/**
 * The mic on/off button (D15): the only control the student needs.
 * TODO(C): start/stop the mic (src/lib/voice/mic.ts), "Listening" animation, apple-design styling.
 */
export function MicButton({ on, onToggle }: { on: boolean; onToggle: (on: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Stop listening" : "Start talking"}
      onPointerDown={() => onToggle(!on)}
      className={`app-press rounded-full px-5 py-3 text-sm font-semibold ${on ? "bg-ink text-white" : "app-glass text-text"}`}
    >
      {on ? "● Listening" : "Talk"}
    </button>
  );
}
