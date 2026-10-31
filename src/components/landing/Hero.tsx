"use client";

import { motion } from "motion/react";
import { GoogleButton } from "./GoogleButton";
import { HeroCanvas } from "./HeroCanvas";
import { spring } from "./motion";

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring, duration: 0.7, delay },
});

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden className="page-grid pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="max-w-xl">
          <motion.p {...enter(0)} className="t-eyebrow inline-flex items-center gap-2 rounded-full bg-ink-wash px-3 py-1.5 text-ink-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            A math tutor that sees your page
          </motion.p>

          <motion.h1 {...enter(0.06)} className="t-display mt-6">
            Circle it.
            <br />
            Ask it.
            <br />
            <span className="text-ink">Get it.</span>
          </motion.h1>

          <motion.p {...enter(0.12)} className="t-lede mt-6 max-w-[34rem] text-muted">
            Circle the step you&rsquo;re stuck on and ask out loud. ∂raft explains that exact step,
            then lets you solve it yourself and checks your work.
          </motion.p>

          <motion.div {...enter(0.18)} className="mt-9 flex flex-wrap items-center gap-3">
            <GoogleButton />
            <a
              href="#how"
              className="pressable btn-quiet inline-flex items-center rounded-full px-6 py-3.5 text-[0.98rem] font-semibold"
            >
              See how it works
            </a>
          </motion.div>

          <motion.p {...enter(0.24)} className="t-small mt-8 text-subtle">
            For iPad and tablets · No typing, no screenshots
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, duration: 0.9, delay: 0.15 }}
        >
          <HeroCanvas />
        </motion.div>
      </div>
    </section>
  );
}
