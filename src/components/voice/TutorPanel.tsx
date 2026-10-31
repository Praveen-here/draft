"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BrainApi, BrainStatus, CanvasApi, PlayerApi, TutorTurn } from "@/lib/contracts";
import { startMic, type MicHandle } from "@/lib/voice";
import { MicButton } from "./MicButton";

type Msg =
  | { id: number; role: "student"; text: string }
  | { id: number; role: "tutor"; turn: TutorTurn; spoken: number; finished: boolean };

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };

/** Only auto-focus the text box with a mouse/trackpad. On tablets it would pop up the keyboard and zoom the page. */
const focusIfDesktop = (el: HTMLInputElement | null) => {
  if (el && matchMedia("(pointer: fine)").matches) el.focus({ preventScroll: true });
};

const KIND_LABEL: Record<string, string> = {
  "next-step": "Next step",
  why: "Why",
  meaning: "Meaning",
  check: "Check",
  show: "Show me",
  answer: "Your answer",
  other: "Question",
};

/**
 * The conversation with ∂raft: what you circled, live captions of what it says,
 * what it understood, and the reply box + mic. Part C (voice and conversation).
 */
export function TutorPanel({ canvas, brain, player }: { canvas: CanvasApi; brain: BrainApi; player: PlayerApi }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [circleImg, setCircleImg] = useState<string | null>(null);
  const [status, setStatus] = useState<BrainStatus>({ state: "idle" });
  const [speaking, setSpeaking] = useState(false);
  const [draft, setDraft] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const lastAsked = useRef("");
  const speakingRef = useRef(false);
  const micRef = useRef<MicHandle | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    lastAsked.current = t;
    setMsgs((m) => [...m, { id: nextId.current++, role: "student", text: t }]);
    player.say(t);
  };

  // Listen to the parts.
  useEffect(() => {
    const offs = [
      canvas.onEvent((e) => {
        if (e.type !== "circle") return;
        setCircleImg(e.context.cropImage);
        setMsgs([]);
        setStatus({ state: "idle" });
        setOpen(true);
        requestAnimationFrame(() => focusIfDesktop(inputRef.current));
      }),
      brain.onStatus(setStatus),
      brain.onTurn((turn) => setMsgs((m) => [...m, { id: nextId.current++, role: "tutor", turn, spoken: -1, finished: false }])),
      player.onBeat((turn, index) => {
        speakingRef.current = index !== null;
        setSpeaking(index !== null);
        setMsgs((m) =>
          m.map((msg) =>
            msg.role === "tutor" && msg.turn === turn
              ? { ...msg, spoken: index ?? msg.turn.beats.length - 1, finished: index === null }
              : msg,
          ),
        );
        if (index === null && turn.waitFor === "answer") focusIfDesktop(inputRef.current);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [canvas, brain, player]);

  // Mic on/off (D15). Ignore what the mic hears while ∂raft itself is talking (no echo loop).
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

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, status]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft("");
  };

  const stateLabel = micOn && !speaking ? "Listening" : speaking ? "Speaking" : status.state === "thinking" ? "Thinking" : "Ready";

  return (
    <div
      className="pointer-events-none absolute inset-x-3 bottom-[5.25rem] z-[300] flex justify-end sm:inset-x-auto sm:bottom-[5.5rem] sm:right-3 sm:top-[5rem]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.section
            key="panel"
            aria-label="∂raft tutor"
            className="app-glass pointer-events-auto flex max-h-[46vh] w-full flex-col overflow-hidden rounded-[22px] sm:max-h-none sm:w-[372px]"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={spring}
            style={{ transformOrigin: "bottom right" }}
          >
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-[rgba(15,23,42,0.06)] px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[1.05rem] font-semibold text-white">∂</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] text-text">∂raft</p>
                <p className="flex items-center gap-1.5 text-[0.78rem] font-medium text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      stateLabel === "Listening" ? "bg-listen" : stateLabel === "Ready" ? "bg-check" : "bg-ink"
                    }`}
                  />
                  {stateLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Hide tutor"
                className="app-press flex h-9 w-9 items-center justify-center rounded-xl text-subtle hover:text-text"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </header>

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!circleImg && msgs.length === 0 && <EmptyState />}

              {circleImg && (
                <motion.figure initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-white p-2 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
                  <figcaption className="px-1 pb-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-subtle">You circled</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the canvas */}
                  <img src={circleImg} alt="The area you circled" className="max-h-36 w-full rounded-xl object-contain" />
                </motion.figure>
              )}

              {msgs.map((m) =>
                m.role === "student" ? (
                  <motion.p
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-md bg-ink px-3.5 py-2 text-[0.92rem] leading-[1.4] text-white"
                  >
                    {m.text}
                  </motion.p>
                ) : (
                  <TutorMessage key={m.id} msg={m} />
                ),
              )}

              {status.state === "thinking" && <Thinking />}
              {status.state === "error" && (
                <div className="rounded-2xl bg-[#fff1f1] px-3.5 py-3 text-[0.88rem] text-[#a3282c]">
                  <p>{status.message}</p>
                  <button type="button" onClick={() => send(lastAsked.current)} className="app-press mt-2 font-semibold underline-offset-2 hover:underline">
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Reply */}
            <form onSubmit={submit} className="flex items-center gap-2 border-t border-[rgba(15,23,42,0.06)] p-2.5">
              <MicButton on={micOn} onToggle={setMicOn} />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={circleImg ? "Ask about what you circled…" : "Circle something, then ask…"}
                aria-label="Ask ∂raft"
                className="h-11 min-w-0 flex-1 rounded-full bg-[rgba(15,23,42,0.05)] px-4 text-[16px] text-text outline-none placeholder:text-subtle focus:bg-[rgba(15,23,42,0.07)]"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
                className="app-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity duration-150 disabled:opacity-30"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
                </svg>
              </button>
            </form>
            {micError && <p className="px-4 pb-3 text-[0.8rem] text-[#a3282c]">{micError}</p>}
          </motion.section>
        ) : (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setOpen(true)}
            className="app-glass app-press pointer-events-auto flex h-12 items-center gap-2 self-end rounded-full pl-1.5 pr-4 text-[0.9rem] font-semibold text-text"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={spring}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white">∂</span>
            {stateLabel === "Ready" ? "Ask ∂raft" : stateLabel}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function TutorMessage({ msg }: { msg: Extract<Msg, { role: "tutor" }> }) {
  const { turn, spoken, finished } = msg;
  const shown = turn.beats.slice(0, spoken + 1);
  const insight = turn.insight;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-1.5">
      {insight?.doubt && (
        <p className="flex flex-wrap items-center gap-1.5 text-[0.74rem] text-subtle">
          <span className="rounded-full bg-ink-wash px-2 py-0.5 font-semibold text-ink-deep">{KIND_LABEL[insight.kind] ?? insight.kind}</span>
          <span className="min-w-0">Understood: {insight.doubt}</span>
        </p>
      )}
      <div className="w-fit max-w-[92%] rounded-[18px] rounded-bl-md bg-white px-3.5 py-2.5 text-[0.93rem] leading-[1.45] text-text shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]">
        {shown.length === 0 ? (
          <span className="text-subtle">…</span>
        ) : (
          shown.map((b, i) => (
            <span
              key={i}
              className={`transition-colors duration-300 ${!finished && i === spoken ? "text-ink-deep" : "text-text"}`}
            >
              {i > 0 && " "}
              {b.say}
            </span>
          ))
        )}
      </div>
      {finished && insight && (
        <p className="px-1 text-[0.7rem] text-subtle" style={{ fontVariantNumeric: "tabular-nums" }}>
          {insight.done ? "✓ Solved it" : turn.waitFor === "answer" ? "Your turn: answer above" : turn.waitFor === "line" ? "Your turn: write the next line" : ""}
          {insight.ms ? ` · ${(insight.ms / 1000).toFixed(1)} s` : ""}
        </p>
      )}
    </motion.div>
  );
}

function Thinking() {
  return (
    <div className="flex w-fit items-center gap-1 rounded-[18px] rounded-bl-md bg-white px-4 py-3 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-1 py-6 text-center">
      <svg viewBox="0 0 120 64" className="mx-auto h-16 w-28" aria-hidden>
        <text x="60" y="40" textAnchor="middle" fontSize="22" fill="#0b0d12" fontFamily="var(--font-hand)">∫ x·eˣ dx</text>
        <path d="M14 34c0-16 22-26 46-26s46 9 46 25-21 25-46 25S16 50 14 34z" fill="none" stroke="#2547d0" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="mt-3 text-[0.95rem] font-semibold text-text">Circle what you&rsquo;re stuck on</p>
      <p className="mx-auto mt-1 max-w-[16rem] text-[0.85rem] leading-[1.45] text-muted">
        Draw a loop around a step with the pen, then ask me about it. I&rsquo;ll explain, not just answer.
      </p>
    </div>
  );
}
