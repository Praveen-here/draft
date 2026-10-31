"use client";

import { motion } from "motion/react";

/** The mic on/off button (D15). Feedback on pointer-down; a soft red pulse while listening. */
export function MicButton({ on, onToggle, disabled }: { on: boolean; onToggle: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Stop listening" : "Talk to ∂raft"}
      title={on ? "Stop listening" : "Talk"}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        onToggle(!on);
      }}
      className={`app-press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 disabled:opacity-40 ${
        on ? "bg-listen text-white" : "bg-[rgba(15,23,42,0.06)] text-[#3a3a3c]"
      }`}
    >
      {on && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-listen"
          initial={{ opacity: 0.45, scale: 1 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <svg viewBox="0 0 24 24" className="relative h-[20px] w-[20px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" fill={on ? "currentColor" : "none"} />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </svg>
    </button>
  );
}
