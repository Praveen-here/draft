"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import type { CanvasHandle } from "@/lib/canvas";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

/**
 * Canvas status, as one small glass toast under the top bar: "Reading your writing…" while handwriting is
 * being read, and any canvas notice (e.g. quota, unreadable line). What was circled, the mic and clearing
 * live in the lesson card and the ask pill.
 */
export function CanvasFeedback({ api, reading, notice, onNotice }: {
  api: CanvasHandle; reading: boolean; notice: string | null; onNotice: (message: string | null) => void;
}) {
  useEffect(() => {
    return api.onEvent((event) => { if (event.type === "circle" || event.type === "line") onNotice(null); });
  }, [api, onNotice]);

  const show = notice ?? (reading ? "Reading your writing…" : null);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[5.25rem] z-[300] flex justify-center px-3"
      onPointerDown={(event) => event.stopPropagation()}>
      <AnimatePresence>
        {show && (
          <motion.div
            key={notice ? "notice" : "reading"}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={spring}
            className="app-glass pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full py-2 pl-4 pr-2 text-[0.86rem] font-medium"
          >
            {!notice && <span className="h-2 w-2 animate-pulse rounded-full bg-ink" aria-hidden />}
            <span className={notice ? "text-[#7b4320]" : "text-text"}>{show}</span>
            {notice ? (
              <button type="button" onClick={() => onNotice(null)} aria-label="Dismiss message"
                className="app-press flex h-7 w-7 items-center justify-center rounded-full text-subtle hover:text-text">×</button>
            ) : <span className="w-2" />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
