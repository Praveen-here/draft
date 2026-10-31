"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BrainApi, CanvasApi, PlayerApi } from "@/lib/contracts";
import { startMic, type MicHandle } from "@/lib/voice";
import { MicButton } from "./MicButton";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

/** Only auto-focus with a mouse/trackpad. On tablets it would pop up the keyboard and zoom the page. */
const focusIfDesktop = (el: HTMLInputElement | null) => {
  if (el && matchMedia("(pointer: fine)").matches) el.focus({ preventScroll: true });
};

/**
 * The one floating control: mic on/off (D15), a text field and send. Sits above the toolbar.
 * The conversation itself lives in the lesson card beside the problem, not here. Part C.
 */
export function AskBar({ canvas, brain, player }: { canvas: CanvasApi; brain: BrainApi; player: PlayerApi }) {
  const [draft, setDraft] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [circled, setCircled] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const speakingRef = useRef(false);
  const micRef = useRef<MicHandle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setAwaiting(false);
    player.say(t);
  };

  useEffect(() => {
    const offs = [
      canvas.onEvent((e) => {
        if (e.type !== "circle") return;
        setCircled(true);
        setAwaiting(false);
        requestAnimationFrame(() => focusIfDesktop(inputRef.current));
      }),
      brain.onTurn(() => setAwaiting(false)),
      player.onBeat((turn, index) => {
        speakingRef.current = index !== null;
        if (index === null && turn.waitFor === "answer" && !turn.insight?.done) {
          setAwaiting(true);
          focusIfDesktop(inputRef.current);
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [canvas, brain, player]);

  // Mic on/off. Ignore what the mic hears while ∂raft itself is talking (no echo loop).
  useEffect(() => {
    if (!micOn) return;
    let cancelled = false;
    setMicError(null);
    startMic(
      (text) => {
        if (!speakingRef.current) send(text);
      },
      (message) => {
        setMicError(message);
        setMicOn(false);
      },
    ).then((handle) => {
      if (cancelled) handle.stop();
      else micRef.current = handle;
    });
    return () => {
      cancelled = true;
      micRef.current?.stop();
      micRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send is stable enough for the mic's lifetime
  }, [micOn]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft("");
  };

  const placeholder = micOn
    ? "Listening… just talk"
    : awaiting
      ? "Type your answer…"
      : circled
        ? "Ask about what you circled…"
        : "Circle a problem with the pen, then ask";
  const hasText = draft.trim().length > 0;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-[300] flex flex-col items-center gap-2 px-3"
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AnimatePresence>
        {micError && (
          <motion.p
            key="err"
            role="alert"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={spring}
            className="app-glass pointer-events-auto rounded-full px-4 py-2 text-[0.84rem] font-medium text-[#a3282c]"
            onClick={() => setMicError(null)}
          >
            {micError}
          </motion.p>
        )}
      </AnimatePresence>

      <form
        onSubmit={submit}
        className={`app-glass pointer-events-auto flex h-14 w-full max-w-[560px] items-center gap-1.5 rounded-full p-1.5 transition-shadow duration-300 ${
          awaiting ? "shadow-[0_0_0_2px_rgba(37,71,208,0.35),0_12px_32px_-8px_rgba(16,24,40,0.18)]" : ""
        }`}
      >
        <MicButton on={micOn} onToggle={setMicOn} />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label="Ask ∂raft"
          enterKeyHint="send"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[16px] tracking-[-0.005em] text-text outline-none placeholder:text-subtle"
          // The pill is the field: no second focus ring inside it (the global :focus-visible would add one).
          style={{ outline: "none" }}
        />
        <AnimatePresence initial={false}>
          {hasText && (
            <motion.button
              key="send"
              type="submit"
              aria-label="Send"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={spring}
              className="app-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-[0_6px_16px_-6px_rgba(37,71,208,0.6)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
