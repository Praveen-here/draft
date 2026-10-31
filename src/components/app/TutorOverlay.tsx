"use client";

import { motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { useEditor, useValue } from "tldraw";
import type { VisualStore } from "@/lib/canvas";

/**
 * Draws pinned tutor visuals (graphs) on top of the canvas, moving and scaling with pan/zoom.
 * Pointer events pass through so the pen keeps working underneath.
 */
export function TutorOverlay({ store }: { store: VisualStore }) {
  const editor = useEditor();
  const items = useSyncExternalStore(store.subscribe, store.get, store.get);
  const camera = useValue("camera", () => editor.getCamera(), [editor]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[200] overflow-hidden" aria-live="polite">
        {items.map((item) => {
          const p = editor.pageToViewport({ x: item.x, y: item.y });
          return (
            <div
              key={item.id}
              className="absolute left-0 top-0 origin-top-left"
              style={{ transform: `translate(${p.x}px, ${p.y}px) scale(${camera.z})`, width: item.w, height: item.h }}
            >
              <motion.div
                className="h-full w-full"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              >
                {item.node}
              </motion.div>
            </div>
          );
        })}
    </div>
  );
}
