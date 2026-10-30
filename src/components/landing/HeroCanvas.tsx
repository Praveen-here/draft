"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, DocIcon, GraphIcon, LassoIcon, MicIcon, PenIcon } from "./icons";
import { spring } from "./motion";

/**
 * The Ananya story, played on a sheet of graph paper:
 * write → circle → ask → tutor hint → student solves → engine checks.
 */
const TIMELINE = [
  { phase: 1, at: 500 }, // line 1 written
  { phase: 2, at: 1500 }, // line 2 written
  { phase: 3, at: 2800 }, // the doubt is circled
  { phase: 4, at: 3700 }, // student asks out loud
  { phase: 5, at: 4900 }, // tutor explains (hint 1 of 3)
  { phase: 6, at: 7700 }, // student writes the last line
  { phase: 7, at: 8900 }, // math engine confirms
];
const HOLD_UNTIL = 12500;
const FINAL = 7;

const STEPS = [
  { label: "Circle it", from: 3 },
  { label: "Ask it", from: 4 },
  { label: "It explains", from: 5 },
  { label: "You solve it", from: 6 },
];

export function HeroCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (reduce) {
      setPhase(FINAL);
      return;
    }
    if (!inView) return;

    setPhase(0);
    setClearing(false);
    const timers = TIMELINE.map(({ phase, at }) => setTimeout(() => setPhase(phase), at));
    timers.push(setTimeout(() => setClearing(true), HOLD_UNTIL));
    timers.push(setTimeout(() => setCycle((c) => c + 1), HOLD_UNTIL + 550));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce, cycle]);

  const activeStep = STEPS.reduce((acc, s, i) => (phase >= s.from ? i : acc), -1);

  return (
    <div ref={ref} id="demo" className="relative scroll-mt-24">
      <div className="surface-lg overflow-hidden rounded-[22px]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper-2/80 px-3.5 py-2.5">
          <div className="flex items-center gap-1" role="toolbar" aria-label="Canvas tools (illustration)">
            <Tool icon={<PenIcon className="h-4 w-4" />} label="Pen" />
            <Tool icon={<LassoIcon className="h-4 w-4" />} label="Circle" active={phase >= 3} />
            <Tool icon={<DocIcon className="h-4 w-4" />} label="PDF" />
            <Tool icon={<GraphIcon className="h-4 w-4" />} label="Graph" />
          </div>
          <ListeningPill on={phase >= 4} />
        </div>

        {/* Paper */}
        <motion.div
          key={cycle}
          className="graph-paper relative min-h-[420px] px-6 pb-6 pt-5 sm:min-h-[440px] sm:px-8"
          animate={{ opacity: clearing ? 0 : 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[0.95rem] font-semibold tracking-[-0.01em] text-text">
              Q4.&nbsp; Find <Int /> x e<sup>x</sup> dx
            </p>
            <span className="t-small text-subtle">11:40 pm</span>
          </div>

          <div className="mt-5 space-y-2.5 text-[1.75rem] leading-[1.15] sm:text-[1.95rem]">
            <Ink show={phase >= 1}>
              u = x,&nbsp;&nbsp;dv = e<sup>x</sup> dx
            </Ink>
            <Ink show={phase >= 2} duration={1.1}>
              = x e<sup>x</sup>&nbsp;&nbsp;
              <span className="relative inline-block px-1">
                − <Int /> e<sup>x</sup> dx
                <Circle show={phase >= 3} />
              </span>
            </Ink>
          </div>

          {/* In flow on phones (space reserved, no layout jump); floats top-right from sm up */}
          <div className="mt-4 h-8 sm:absolute sm:right-7 sm:top-[4.6rem] sm:mt-0 sm:h-auto">
            <AnimatePresence>
              {phase >= 4 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                  style={{ transformOrigin: "top right" }}
                >
                  <div className="flex w-fit items-center gap-2 rounded-full bg-ink-wash px-3.5 py-1.5 text-[0.85rem] font-medium text-ink-deep">
                    <MicIcon className="h-3.5 w-3.5" />
                    <span className="italic">&ldquo;why is there a minus?&rdquo;</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_minmax(0,17.5rem)] sm:items-end">
            <div className="text-[1.75rem] leading-[1.15] sm:text-[1.95rem]">
              <Ink show={phase >= 6} duration={1.0} tone="answer">
                = x e<sup>x</sup> − e<sup>x</sup> + C
              </Ink>
              <div className="mt-1 h-7">
                <AnimatePresence>
                  {phase >= 7 && (
                    <motion.div
                      className="flex items-center gap-1.5 text-check"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
                      style={{ transformOrigin: "left center" }}
                    >
                      <CheckIcon className="h-6 w-6" />
                      <span className="hand text-[1.15rem] text-check">her own answer</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <TutorCard show={phase >= 5} speaking={phase >= 5 && phase < 7} checked={phase >= 7} />
          </div>
        </motion.div>
      </div>

      {/* Step rail, synced with the story */}
      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="What's happening">
        {STEPS.map((s, i) => {
          const active = i === activeStep;
          return (
            <li key={s.label} className="relative">
              {active && (
                <motion.span
                  layoutId="step-highlight"
                  className="absolute inset-0 rounded-xl bg-ink-wash"
                  transition={spring}
                />
              )}
              <span
                className={`relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[0.78rem] font-semibold tracking-[0.005em] transition-colors duration-300 sm:text-[0.82rem] ${
                  active ? "text-ink-deep" : i < activeStep ? "text-muted" : "text-subtle"
                }`}
              >
                <span className="tabular-nums">{i + 1}</span>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Int() {
  return <span className="mx-[0.06em] inline-block font-serif italic">∫</span>;
}

function Tool({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors duration-300 ${
        active ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-ink/25" : "text-muted"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function ListeningPill({ on }: { on: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-[0.78rem] font-semibold transition-colors duration-300 ${
        on ? "bg-[#fdecec] text-listen" : "bg-black/[0.04] text-subtle"
      }`}
    >
      <span className="relative flex h-2 w-2">
        {on && (
          <motion.span
            className="absolute inset-0 rounded-full bg-listen"
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className={`relative h-2 w-2 rounded-full ${on ? "bg-listen" : "bg-subtle/60"}`} />
      </span>
      {on ? "Listening" : "Mic on"}
    </span>
  );
}

/** Handwriting that "writes itself" left to right. */
function Ink({
  show,
  children,
  duration = 0.9,
  tone = "work",
}: {
  show: boolean;
  children: ReactNode;
  duration?: number;
  tone?: "work" | "answer";
}) {
  return (
    <motion.div
      className={`hand w-fit whitespace-nowrap font-semibold ${tone === "answer" ? "!text-[#1d6b45]" : ""}`}
      // Negative insets leave room for the circle and italic overhangs once fully written
      initial={{ clipPath: "inset(-40% 100% -40% -12%)" }}
      animate={{ clipPath: show ? "inset(-40% -12% -40% -12%)" : "inset(-40% 100% -40% -12%)" }}
      transition={{ duration: show ? duration : 0, ease: [0.45, 0.05, 0.4, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** A hand-drawn loop around the doubt. */
function Circle({ show }: { show: boolean }) {
  return (
    <svg
      viewBox="0 0 220 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -left-5 -top-3.5 h-[calc(100%+1.75rem)] w-[calc(100%+2.5rem)] overflow-visible"
      aria-hidden
    >
      <motion.path
        d="M 38 16 C 82 2, 176 4, 205 30 C 224 50, 186 84, 108 85 C 44 86, 6 70, 10 46 C 13 26, 46 11, 86 8"
        fill="none"
        stroke="#2547d0"
        strokeWidth={2.6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={show ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: show ? 0.75 : 0, ease: [0.5, 0, 0.3, 1] }}
      />
    </svg>
  );
}

function TutorCard({ show, speaking, checked }: { show: boolean; speaking: boolean; checked: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="surface rounded-2xl p-4"
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={spring}
          style={{ transformOrigin: "top left" }}
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink">
              <Waveform active={speaking} />
              Tutor · hint 1 of 3
            </span>
          </div>
          <p className="mt-2.5 text-[0.9rem] leading-[1.5] text-text">
            Good question! The minus comes from the rule
          </p>
          <p className="mt-1.5 rounded-lg bg-paper-2 px-2.5 py-1.5 text-center text-[0.95rem] font-semibold tracking-[-0.01em]">
            <Int />u dv = uv − <Int />v du
          </p>
          <p className="mt-2 text-[0.9rem] leading-[1.5] text-muted">
            Here v du = e<sup>x</sup> dx. Can you finish that last integral?
          </p>
          <div className="mt-3 h-7">
            <AnimatePresence>
              {checked && (
                <motion.span
                  className="inline-flex items-center gap-1.5 rounded-full bg-check-wash px-2.5 py-1 text-[0.75rem] font-semibold text-check"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Checked by math engine
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = [0.55, 1, 0.7, 0.9];
  return (
    <span className="flex h-3.5 items-center gap-[2px]" aria-hidden>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-ink"
          style={{ height: "100%", originY: 0.5 }}
          animate={active ? { scaleY: [h * 0.35, h, h * 0.5, h * 0.85, h * 0.35] } : { scaleY: 0.3 }}
          transition={
            active ? { duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" } : spring
          }
        />
      ))}
    </span>
  );
}
