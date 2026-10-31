"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BrainApi, BrainStatus, NoteKind, PlayerApi, TutorTurn, VisualAction } from "@/lib/contracts";

/** iMessage-style colours: the tutor's bubbles are white (incoming), the student's blue (outgoing). */
const BLUE = "#0a7cff";
/** Same colours as the numbered marks on the page (Part A's noteTone.ts): keep the two in step. */
const TONE: Record<NoteKind, { colour: string; wash: string; label: string }> = {
  variable: { colour: "#2547d0", wash: "#eef2fd", label: "Variable" },
  number: { colour: "#168a52", wash: "#e8f6ee", label: "Number" },
  rule: { colour: "#6e4bd8", wash: "#f1edfd", label: "Rule" },
  mistake: { colour: "#d4452f", wash: "#fdeeeb", label: "Check this" },
};
const STARTERS = ["How do I start?", "Why this step?", "What do these mean?", "Is this right?"];

type Msg =
  | { id: number; from: "student"; text: string }
  | { id: number; from: "tutor"; turn: TutorTurn; spoken: number; finished: boolean };

/**
 * The conversation about one circled problem, as message bubbles that float beside the circle.
 * The tutor's sentences arrive as white bubbles while it speaks them, with explain cards, written steps and
 * "view graph" links as their own bubbles; the student's questions and answers are blue. A new circle
 * replaces the thread. Part C (voice and conversation).
 *
 * @param asked the question that opened this thread, when it was opened by asking (not by circling).
 */
export function LessonCard({ brain, player, asked }: { brain: BrainApi; player: PlayerApi; asked?: string }) {
  const nextId = useRef(1);
  const [msgs, setMsgs] = useState<Msg[]>(() => (asked ? [{ id: nextId.current++, from: "student", text: asked }] : []));
  const [status, setStatus] = useState<BrainStatus>(asked ? { state: "thinking" } : { state: "idle" });
  const lastSaid = useRef(asked ?? "");
  const reduce = !!useReducedMotion();

  useEffect(() => {
    const offs = [
      brain.onStatus(setStatus),
      brain.onTurn((turn) => setMsgs((m) => [...m, { id: nextId.current++, from: "tutor", turn, spoken: -1, finished: false }])),
      player.onBeat((turn, index) =>
        setMsgs((m) => m.map((msg) => (msg.from === "tutor" && msg.turn === turn
          ? { ...msg, spoken: index ?? turn.beats.length - 1, finished: index === null }
          : msg))),
      ),
      player.onStudentSaid((s) => {
        lastSaid.current = s.transcript;
        setMsgs((m) => [...m, { id: nextId.current++, from: "student", text: s.transcript }]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [brain, player]);

  const last = msgs[msgs.length - 1];
  const asking = !msgs.some((m) => m.from === "student");
  const thinking = status.state === "thinking";
  const speaking = last?.from === "tutor" && !last.finished;
  const done = last?.from === "tutor" && last.finished && !!last.turn.insight?.done;
  const label = done ? "Solved" : thinking ? "Thinking…" : speaking ? "Speaking" : last?.from === "tutor" && last.finished ? "Your turn" : "Here to help";

  // Explain cards are numbered in the order they appear, like the marks on the page.
  const numbers = new Map<string, number>();

  const close = () => {
    player.stop();
    brain.reset();
  };

  return (
    <section aria-label="Conversation with ∂raft" className="flex flex-col gap-1.5">
      {/* Who's talking, and a way out */}
      {/* Also the handle: drag it to move the conversation, double-click to let it place itself again.
          It stays at the top while older bubbles scroll under it, so it can always be grabbed. */}
      <div
        className="sticky top-3 z-10 -mx-3 -mt-1 px-3 pb-2.5 pt-1"
        // Scroll edge effect: bubbles passing under the handle blur and fade, instead of meeting a hard edge.
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          maskImage: "linear-gradient(to bottom, #000 calc(100% - 12px), transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 calc(100% - 12px), transparent)",
        }}
      >
      <div
        data-drag-handle=""
        title="Drag to move · double-click to put it back"
        className="app-glass flex w-fit cursor-grab touch-none select-none items-center gap-2 rounded-full py-1 pl-1 pr-1.5 active:cursor-grabbing"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[0.8rem] font-semibold text-white">∂</span>
        <span className="text-[0.8rem] font-semibold text-text">∂raft</span>
        <span className="text-[0.76rem] font-medium text-muted">· {label}</span>
        <svg aria-hidden viewBox="0 0 10 16" className="ml-0.5 h-3.5 w-2.5 text-[#b4b8c2]" fill="currentColor">
          {[3, 8, 13].map((y) => <g key={y}><circle cx="2.5" cy={y} r="1.3" /><circle cx="7.5" cy={y} r="1.3" /></g>)}
        </svg>
        <button
          type="button"
          onClick={close}
          aria-label="Close this conversation"
          className="app-press ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-subtle hover:bg-[rgba(15,23,42,0.06)] hover:text-text"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      </div>

      <AnimatePresence initial={true}>
        {asking && !thinking && (
          <Bubble key="hello" from="tutor" tail reduce={reduce}>
            What would you like to know about this?
          </Bubble>
        )}
        {asking && !thinking && (
          <motion.div
            key="starters"
            className="flex flex-wrap justify-end gap-1.5 pt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : 0.15 }}
          >
            {STARTERS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => player.say(q)}
                className="app-press rounded-full border bg-white/90 px-3 py-1.5 text-[0.84rem] font-semibold shadow-[0_2px_8px_-4px_rgba(16,24,40,0.25)] backdrop-blur"
                style={{ color: BLUE, borderColor: "rgba(10,124,255,0.35)" }}
              >
                {q}
              </button>
            ))}
          </motion.div>
        )}

        {msgs.map((m, i) => {
          const nextFrom = msgs[i + 1]?.from ?? (thinking ? "tutor" : undefined);
          if (m.from === "student") {
            return (
              <Bubble key={m.id} from="student" tail={nextFrom !== "student"} reduce={reduce}>
                {m.text}
              </Bubble>
            );
          }
          return <TutorTurnBubbles key={m.id} msg={m} numbers={numbers} lastInGroup={nextFrom !== "tutor"} reduce={reduce} />;
        })}

        {thinking && <Typing key="typing" reduce={reduce} />}

        {status.state === "error" && !thinking && (
          <Bubble key="error" from="tutor" tail reduce={reduce}>
            <span className="text-[#a3282c]">{status.message}</span>{" "}
            <button
              type="button"
              onClick={() => lastSaid.current && player.say(lastSaid.current)}
              className="app-press font-semibold underline underline-offset-2"
              style={{ color: BLUE }}
            >
              Try again
            </button>
          </Bubble>
        )}

        {last?.from === "tutor" && last.finished && !thinking && (
          <motion.p
            key={`hint-${last.id}`}
            className="app-glass mt-0.5 w-fit self-start rounded-full px-3 py-1 text-[0.76rem] font-medium text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {done
              ? "✓ Solved. Circle the next problem when you’re ready."
              : last.turn.waitFor === "line"
                ? "Your turn · write the next line on the page"
                : last.turn.waitFor === "answer"
                  ? "Your turn · answer out loud or type below"
                  : null}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

/** One tutor turn: a bubble per spoken sentence, as it's said, each followed by the cards it brought. */
function TutorTurnBubbles({ msg, numbers, lastInGroup, reduce }: {
  msg: Extract<Msg, { from: "tutor" }>; numbers: Map<string, number>; lastInGroup: boolean; reduce: boolean;
}) {
  const shown = msg.turn.beats.slice(0, msg.spoken + 1);
  const solved = msg.finished && msg.turn.insight?.done;
  const parts: ReactNode[] = [];
  shown.forEach((beat, i) => {
    const lastBeat = i === shown.length - 1;
    const extras = beat.visuals.flatMap((v, j) => attachment(v, `${msg.id}-${i}-${j}`, numbers, reduce));
    parts.push(
      <Bubble key={`${msg.id}-${i}`} from="tutor" tail={lastBeat && !extras.length && !solved && lastInGroup} reduce={reduce}>
        {beat.say}
      </Bubble>,
    );
    parts.push(...extras);
  });
  if (solved) {
    parts.push(
      <Bubble key={`${msg.id}-solved`} from="tutor" tail={lastInGroup} reduce={reduce}>
        <span className="flex items-center gap-2 font-semibold text-check">
          <motion.span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-check text-white"
            initial={reduce ? false : { scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </motion.span>
          You solved it
        </span>
      </Bubble>,
    );
  }
  return <>{parts}</>;
}

/** What a beat brings along: an explain card, a written step, or a link to its graph. */
function attachment(v: VisualAction, key: string, numbers: Map<string, number>, reduce: boolean): ReactNode[] {
  if (v.type === "note") {
    if (!numbers.has(v.id)) numbers.set(v.id, numbers.size + 1);
    const tone = TONE[v.kind] ?? TONE.variable;
    return [
      <Bubble key={key} from="tutor" reduce={reduce} plain>
        <span className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.78rem] font-bold text-white"
            style={{ background: tone.colour, fontVariantNumeric: "tabular-nums" }}
          >
            {numbers.get(v.id)}
          </span>
          <span className="min-w-0">
            <span className="block text-[0.66rem] font-semibold uppercase tracking-[0.07em]" style={{ color: tone.colour }}>{tone.label}</span>
            <span className="block text-[1.05rem] font-semibold leading-[1.25] tracking-[-0.012em]">{v.title}</span>
            {v.text && <span className="mt-0.5 block text-[0.88rem] leading-[1.4] text-muted">{v.text}</span>}
          </span>
        </span>
      </Bubble>,
    ];
  }
  if (v.type === "writeStep") {
    return [
      <Bubble key={key} from="tutor" reduce={reduce}>
        <span className="hand block text-[1.6rem] leading-[1.15]" style={reduce ? undefined : { animation: "draft-write 900ms cubic-bezier(0.3, 0, 0.2, 1) both" }}>
          {v.text}
        </span>
      </Bubble>,
    ];
  }
  if (v.type === "plot" || (v.type === "showVisual" && (v.kind === "tangent" || v.kind === "area"))) {
    const fn = v.type === "plot" ? v.fn : String(v.args.fn ?? "");
    const what = v.type === "plot" ? "Graph" : v.kind === "tangent" ? "Tangent" : "Area";
    return [
      <motion.button
        key={key}
        type="button"
        onClick={() => window.dispatchEvent(new Event("draft:show-graphs"))}
        className="app-press flex w-fit items-center gap-2 self-start rounded-full border border-[rgba(37,71,208,0.18)] bg-white px-3 py-1.5 text-[0.82rem] font-semibold text-ink shadow-[0_2px_8px_-4px_rgba(16,24,40,0.25)]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
        style={{ transformOrigin: "left center" }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 3v18h18" /><path d="M6 16c3-8 6-8 9-3s4 2 6-4" />
        </svg>
        {what}{fn ? `: y = ${pretty(fn)}` : ""}
        <span className="text-subtle">›</span>
      </motion.button>,
    ];
  }
  return [];
}

/** "a*x^2" → "a·x²": a formula as a student would write it. */
function pretty(fn: string): string {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return fn.replace(/\^(\d)(?!\d)/g, (_, d: string) => sup[d]).replace(/\*/g, "·").replace(/\bexp\(x\)/g, "eˣ");
}

/**
 * A message bubble. Tutor (incoming): white, on the left, tail at the bottom-left. Student (outgoing): blue,
 * on the right, tail at the bottom-right. Only the last bubble in a run from the same person has a tail.
 */
function Bubble({ from, tail = false, plain = false, reduce, children }: {
  from: "tutor" | "student"; tail?: boolean; plain?: boolean; reduce: boolean; children: ReactNode;
}) {
  const mine = from === "student";
  const fill = mine ? BLUE : "#ffffff";
  return (
    <motion.div
      className={`relative max-w-[88%] ${mine ? "self-end" : "self-start"}`}
      style={{
        transformOrigin: mine ? "bottom right" : "bottom left",
        // One shadow for bubble and tail together, so the tail reads as part of the bubble.
        filter: mine ? "none" : "drop-shadow(0 0.5px 0.5px rgba(15,23,42,0.14)) drop-shadow(0 6px 14px rgba(16,24,40,0.12))",
      }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", bounce: 0.22, duration: 0.42 }}
    >
      <div
        className={`rounded-[20px] ${plain ? "px-3.5 py-3" : "px-3.5 py-[9px]"} text-[1rem] leading-[1.38] tracking-[-0.008em]`}
        style={{ background: fill, color: mine ? "#fff" : "#0b0d12" }}
      >
        {children}
      </div>
      {tail && (
        <svg
          aria-hidden
          viewBox="0 0 17 21"
          width={17}
          height={21}
          className="absolute bottom-0"
          style={mine ? { right: -5, transform: "scaleX(-1)" } : { left: -5 }}
        >
          <path d="M16.8 0.5 C16.8 9.5 13 16.5 0 20.6 C7 21.4 13.4 20.3 17 16.6 Z" fill={fill} />
        </svg>
      )}
    </motion.div>
  );
}

/** "∂raft is typing": three dots in an incoming bubble. */
function Typing({ reduce }: { reduce: boolean }) {
  return (
    <Bubble from="tutor" tail reduce={reduce}>
      <span className="flex h-[1.38rem] items-center gap-1" aria-label="∂raft is thinking">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-[#9a9aa0]"
            animate={reduce ? undefined : { opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
          />
        ))}
      </span>
    </Bubble>
  );
}
