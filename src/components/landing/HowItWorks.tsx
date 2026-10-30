"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { CheckIcon, LassoIcon, MicIcon, SparkIcon } from "./icons";
import { Reveal } from "./motion";

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-t border-line/70 bg-paper-2">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <Reveal className="max-w-2xl">
          <p className="t-eyebrow text-ink">How it works</p>
          <h2 className="t-h2 mt-3">Three moves. No typing.</h2>
          <p className="t-lede mt-5 text-muted">
            You already know how to point at the part you don&rsquo;t get. ∂raft just listens.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <Reveal delay={0}>
            <Card
              n="1"
              icon={<LassoIcon className="h-5 w-5" />}
              title="Circle it"
              body="Draw around any problem on your PDF, or just the one step you don't get."
              visual={<CircleVisual />}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <Card
              n="2"
              icon={<MicIcon className="h-5 w-5" />}
              title="Ask it"
              body="Just talk, like you would to a friend next to you. It knows when you're talking to it."
              visual={<AskVisual />}
            />
          </Reveal>
          <Reveal delay={0.16}>
            <Card
              n="3"
              icon={<SparkIcon className="h-5 w-5" />}
              title="Learn it"
              body="It explains that exact part out loud, then lets you write the next line and checks it."
              visual={<LearnVisual />}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Card({
  n,
  icon,
  title,
  body,
  visual,
}: {
  n: string;
  icon: ReactNode;
  title: string;
  body: string;
  visual: ReactNode;
}) {
  return (
    <article className="surface flex h-full flex-col overflow-hidden rounded-[20px]">
      <div className="graph-paper relative flex h-44 items-center justify-center border-b border-line">{visual}</div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2.5 text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-wash">{icon}</span>
          <span className="t-small font-semibold text-subtle tabular-nums">0{n}</span>
        </div>
        <h3 className="t-h3 mt-4">{title}</h3>
        <p className="mt-2 text-[0.95rem] leading-[1.55] text-muted">{body}</p>
      </div>
    </article>
  );
}

function CircleVisual() {
  return (
    <div className="relative px-4">
      <span className="hand text-[1.9rem] font-semibold">
        − <span className="font-serif italic">∫</span> e<sup>x</sup> dx
      </span>
      <svg viewBox="0 0 220 90" preserveAspectRatio="none" className="absolute -inset-x-3 -inset-y-4 h-[calc(100%+2rem)] w-[calc(100%+1.5rem)] overflow-visible" aria-hidden>
        <motion.path
          d="M 38 16 C 82 2, 176 4, 205 30 C 224 50, 186 84, 108 85 C 44 86, 6 70, 10 46 C 13 26, 46 11, 86 8"
          fill="none"
          stroke="#2547d0"
          strokeWidth={2.4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.5, 0, 0.3, 1] }}
        />
      </svg>
    </div>
  );
}

function AskVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[0.9rem] font-medium text-ink-deep shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_20px_-10px_rgba(37,71,208,0.35)] ring-1 ring-ink/10">
        <MicIcon className="h-4 w-4" />
        <span className="italic">&ldquo;why is there a minus here?&rdquo;</span>
      </div>
      <div className="flex h-6 items-center gap-[3px]" aria-hidden>
        {[0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.75, 0.35, 0.6].map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-ink/40" style={{ height: `${h * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function LearnVisual() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5">
        {["Nudge", "Hint", "Step"].map((l, i) => (
          <span
            key={l}
            className={`rounded-full px-3 py-1 text-[0.75rem] font-semibold ${
              i === 0 ? "bg-ink text-white" : "bg-white text-subtle ring-1 ring-line"
            }`}
          >
            {l}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="hand text-[1.7rem] font-semibold !text-[#1d6b45]">= x e<sup>x</sup> − e<sup>x</sup> + C</span>
        <CheckIcon className="h-6 w-6 text-check" />
      </div>
    </div>
  );
}
