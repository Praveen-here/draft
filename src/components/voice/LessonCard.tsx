"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { BrainApi, BrainStatus, PlayerApi, TutorTurn } from "@/lib/contracts";

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };

const KIND_LABEL: Record<string, string> = {
  "next-step": "Next step",
  why: "Why",
  meaning: "Meaning",
  check: "Check",
  show: "One step",
  answer: "Your answer",
  other: "Question",
};

const STARTERS = ["How do I start?", "Why this step?", "What do these mean?", "Is this right?"];

/**
 * The lesson card at the top of the column beside the circled problem: what ∂raft understood,
 * the sentence it is saying now, its question, and "Solved" at the end. One problem, one card;
 * a new circle replaces it. Part C (voice and conversation).
 *
 * @param asked the question that opened this card, when it was opened by asking (not by circling).
 */
export function LessonCard({ brain, player, asked }: { brain: BrainApi; player: PlayerApi; asked?: string }) {
  const [turn, setTurn] = useState<TutorTurn | null>(null);
  const [spoken, setSpoken] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<BrainStatus>(asked ? { state: "thinking" } : { state: "idle" });
  const [said, setSaid] = useState<string | null>(asked ?? null);
  const lastSaid = useRef(asked ?? "");
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const offs = [
      brain.onStatus(setStatus),
      brain.onTurn((t) => {
        setTurn(t);
        setSpoken(-1);
        setFinished(false);
      }),
      player.onBeat((t, index) => {
        setSpoken(index ?? t.beats.length - 1);
        setFinished(index === null);
      }),
      player.onStudentSaid((s) => {
        lastSaid.current = s.transcript;
        setSaid(s.transcript);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [brain, player]);

  const thinking = status.state === "thinking";
  const done = !!turn?.insight?.done && finished;
  const fresh = !turn && !thinking && status.state !== "error";
  const speaking = !!turn && !finished && spoken >= 0;
  const stateLabel = done ? "Solved" : thinking ? "Thinking" : speaking ? "Speaking" : turn && finished ? "Your turn" : "Ready";

  const close = () => {
    player.stop();
    brain.reset();
  };

  return (
    <section
      aria-label="∂raft lesson"
      className="overflow-hidden rounded-[24px] bg-white shadow-[0_0_0_0.5px_rgba(15,23,42,0.1),0_2px_6px_rgba(16,24,40,0.05),0_24px_56px_-20px_rgba(23,37,110,0.34)]"
    >
      <header className="flex items-center gap-2.5 px-4 pb-1 pt-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[0.92rem] font-semibold text-white">∂</span>
        <p className="text-[0.92rem] font-semibold tracking-[-0.01em] text-text">∂raft</p>
        <StatusPill label={stateLabel} reduce={reduce} />
        <button
          type="button"
          onClick={close}
          aria-label="Close this lesson"
          className="app-press -mr-1.5 ml-auto flex h-8 w-8 items-center justify-center rounded-full text-subtle hover:bg-[rgba(15,23,42,0.05)] hover:text-text"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="px-4 pb-4 pt-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {fresh && (
            <motion.div key="fresh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <p className="text-[1.15rem] font-semibold leading-[1.3] tracking-[-0.018em] text-text">What would you like to know about this?</p>
              <p className="mt-1 text-[0.88rem] text-muted">Ask out loud or type below, or tap one:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => player.say(q)}
                    className="app-press rounded-full bg-ink-wash px-3.5 py-2 text-[0.86rem] font-semibold text-ink-deep hover:bg-[#e3e9fc]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {!fresh && (
            <motion.div key="lesson" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              {said && (
                <p className="mb-2 flex items-baseline gap-1.5 text-[0.84rem] text-muted">
                  <span className="shrink-0 font-semibold text-subtle">You</span>
                  <span className="line-clamp-2">&ldquo;{said}&rdquo;</span>
                </p>
              )}

              {turn?.insight?.doubt && !thinking && (
                <p className="mb-2.5 flex items-center gap-2 text-[0.78rem] text-subtle">
                  <span className="shrink-0 rounded-full bg-ink-wash px-2 py-0.5 font-semibold text-ink-deep">
                    {KIND_LABEL[turn.insight.kind] ?? turn.insight.kind}
                  </span>
                  <span className="line-clamp-1 min-w-0">{turn.insight.doubt}</span>
                </p>
              )}

              {thinking ? (
                <Thinking reduce={reduce} />
              ) : status.state === "error" ? (
                <div className="rounded-2xl bg-[#fff1f1] px-3.5 py-3 text-[0.9rem] text-[#a3282c]">
                  <p>{status.message}</p>
                  <button
                    type="button"
                    onClick={() => lastSaid.current && player.say(lastSaid.current)}
                    className="app-press mt-1.5 font-semibold underline-offset-2 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : turn ? (
                <Spoken turn={turn} spoken={spoken} finished={finished} />
              ) : null}

              <AnimatePresence initial={false}>
                {turn && finished && !thinking && (
                  <motion.div
                    key={done ? "done" : turn.waitFor}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                  >
                    {done ? <Solved reduce={reduce} /> : <YourTurn turn={turn} />}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

/** The current turn, sentence by sentence as it is spoken; the sentence being said now is in ink. */
function Spoken({ turn, spoken, finished }: { turn: TutorTurn; spoken: number; finished: boolean }) {
  const shown = turn.beats.slice(0, Math.max(0, spoken) + 1);
  return (
    <p className="text-[1.06rem] leading-[1.5] tracking-[-0.008em] text-text">
      {spoken < 0 ? (
        <span className="text-subtle">…</span>
      ) : (
        shown.map((b, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={`transition-colors duration-300 ${!finished && i === spoken ? "text-ink-deep" : "text-text"}`}
          >
            {i > 0 && " "}
            {b.say}
          </motion.span>
        ))
      )}
    </p>
  );
}

function YourTurn({ turn }: { turn: TutorTurn }) {
  if (turn.waitFor === "none") return null;
  return (
    <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-ink-wash px-3.5 py-3">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {turn.waitFor === "line" ? <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /> : <path d="M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />}
      </svg>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-ink">Your turn</p>
        <p className="mt-0.5 text-[0.9rem] leading-[1.4] text-ink-deep">
          {turn.waitFor === "line" ? "Write the next line on the page." : "Answer out loud, or type it below."}
        </p>
      </div>
    </div>
  );
}

function Solved({ reduce }: { reduce: boolean }) {
  return (
    <div className="mt-3.5 flex items-center gap-3 rounded-2xl bg-check-wash px-3.5 py-3">
      <motion.span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-check text-white"
        initial={reduce ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.15 }} />
        </svg>
      </motion.span>
      <div>
        <p className="text-[0.95rem] font-semibold text-check">You solved it</p>
        <p className="text-[0.84rem] text-muted">Circle the next problem when you&rsquo;re ready.</p>
      </div>
    </div>
  );
}

function StatusPill({ label, reduce }: { label: string; reduce: boolean }) {
  const colour = label === "Solved" ? "bg-check" : label === "Ready" || label === "Your turn" ? "bg-subtle" : "bg-ink";
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-[rgba(15,23,42,0.045)] px-2 py-0.5 text-[0.74rem] font-semibold text-muted">
      {label === "Speaking" && !reduce ? (
        <span className="flex h-2.5 items-end gap-[2px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-[2.5px] rounded-full bg-ink"
              animate={{ height: ["35%", "100%", "35%"] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
          ))}
        </span>
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${colour}`} aria-hidden />
      )}
      {label}
    </span>
  );
}

function Thinking({ reduce }: { reduce: boolean }) {
  return (
    <div aria-label="Thinking" className="space-y-2 py-1">
      <p className="text-[0.88rem] text-muted">Looking at what you circled…</p>
      {[92, 74, 58].map((w, i) => (
        <motion.div
          key={w}
          className="h-3 rounded-full bg-[rgba(37,71,208,0.09)]"
          style={{ width: `${w}%` }}
          animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
