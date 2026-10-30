"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/** Critically damped house spring: no overshoot, ~0.45s response. */
export const spring = { type: "spring" as const, bounce: 0, duration: 0.45 };

/** Honors the OS "Reduce Motion" setting: transforms are dropped, opacity stays. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades content up into place the first time it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ ...spring, duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}
