"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useEditor, useQuickReactor } from "tldraw";
import type { BBox } from "@/lib/contracts";
import { LESSON_CARD_ID, type LessonColumn, type LessonItem, type VisualStore } from "@/lib/canvas";
import { NOTE_TONE, NoteCard, StepCard } from "./NoteCard";

const spring = { type: "spring" as const, bounce: 0, duration: 0.45 };
const GAP = 12;
/** A column taller than the screen shrinks a little to fit, but never below this (text stays readable). */
const MIN_FIT = 0.82;

/**
 * The lesson column beside the circled problem: the lesson card, numbered explain cards matching numbered
 * marks on their terms, graphs and written steps. Lives in page space, so it pans and zooms with the page.
 * Only the lesson card takes touches; everything else lets the pen through.
 */
export function TutorOverlay({ store }: { store: VisualStore }) {
  const editor = useEditor();
  const { column, items, gen } = useSyncExternalStore(store.subscribe, store.get, store.get);
  const reduce = !!useReducedMotion();
  const layer = useRef<HTMLDivElement>(null);

  // Follow the camera straight on the DOM, in the same frame as the canvas: no React render per scroll
  // frame, so the cards stay glued to the page instead of trailing behind it.
  useQuickReactor(
    "tutor overlay camera",
    () => {
      const { x, y, z } = editor.getCamera();
      if (layer.current) layer.current.style.transform = `scale(${z}) translate(${x}px, ${y}px)`;
    },
    [editor],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[200] overflow-hidden" aria-live="polite">
      <div ref={layer} className="absolute left-0 top-0 origin-top-left">
        <AnimatePresence>
          {column && (
            <motion.div
              key={gen}
              initial={{ opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(4px)" }}
              transition={{ duration: 0.25 }}
              style={{ transformOrigin: `${column.x}px ${column.y}px` }}
            >
              <Column column={column} items={items} reduce={reduce} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Column({ column, items, reduce }: { column: LessonColumn; items: LessonItem[]; reduce: boolean }) {
  const colRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  // The column's height (layout value, in page units), so a tall column can shrink and slide to fit.
  useLayoutEffect(() => {
    const el = colRef.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Explain cards that point at a term get numbers 1, 2, 3...; the same number marks the term on the page.
  const numbers = new Map<string, number>();
  for (const i of items) if (i.kind === "note" && i.anchor) numbers.set(i.id, numbers.size + 1);

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.97 };
  // As cards arrive the column grows: first shrink it a little if it can't fit the screen, then slide it up
  // so its bottom stays on screen (never above the top bar).
  const room = column.maxY - column.minY;
  const scale = height > room ? Math.max(MIN_FIT, room / height) : 1;
  const top = Math.max(column.minY, Math.min(column.y, column.maxY - height * scale));

  return (
    <>
      <TermMarks items={items} numbers={numbers} reduce={reduce} />
      <motion.div
        ref={colRef}
        className="absolute flex flex-col"
        style={{ left: column.x, width: column.w, gap: GAP, transformOrigin: "top left" }}
        initial={false}
        animate={{ top, scale }}
        transition={reduce ? { duration: 0 } : spring}
      >
        <AnimatePresence initial={true}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={enter}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
              transition={spring}
              style={{ transformOrigin: "top left" }}
              className={item.id === LESSON_CARD_ID ? "pointer-events-auto" : undefined}
              onPointerDown={item.id === LESSON_CARD_ID ? (e) => e.stopPropagation() : undefined}
            >
              {item.kind === "note" ? (
                <NoteCard note={item.note} number={numbers.get(item.id)} />
              ) : item.kind === "step" ? (
                <StepCard text={item.text} reduce={reduce} />
              ) : (
                item.node
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
}

/**
 * On the page: a soft tinted outline around each explained term, with a numbered badge on its corner.
 * The card with the same number explains it, so nothing has to cross the page to connect them.
 */
function TermMarks({ items, numbers, reduce }: { items: LessonItem[]; numbers: Map<string, number>; reduce: boolean }) {
  const notes = items.filter((i): i is Extract<LessonItem, { kind: "note" }> => i.kind === "note" && !!i.anchor);
  const r = 9;
  // Badges sit on the top-right corner of their term; when two terms are close, step a badge right
  // until it no longer touches one already placed.
  const placed: { x: number; y: number }[] = [];
  const badgeAt = (a: BBox) => {
    const p = { x: a.x + a.w, y: a.y };
    while (placed.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < r * 2 + 3)) p.x += r * 2 + 3;
    placed.push(p);
    return p;
  };
  return (
    <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1} aria-hidden>
      <AnimatePresence>
        {notes.map((item) => {
          const tone = NOTE_TONE[item.note.kind] ?? NOTE_TONE.variable;
          const a = pad(item.anchor as BBox, 4);
          const n = numbers.get(item.id);
          const { x: bx, y: by } = badgeAt(a);
          return (
            <motion.g key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={Math.min(8, a.h / 2)} fill={tone.colour} fillOpacity={0.1} stroke={tone.colour} strokeOpacity={0.55} strokeWidth={1.25} />
              {n !== undefined && (
                <motion.g
                  style={{ originX: `${bx}px`, originY: `${by}px` }}
                  initial={reduce ? false : { scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.45 }}
                >
                  <circle cx={bx} cy={by} r={r + 1.5} fill="#fff" />
                  <circle cx={bx} cy={by} r={r} fill={tone.colour} />
                  <text x={bx} y={by} dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {n}
                  </text>
                </motion.g>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}

const pad = (b: BBox, p: number): BBox => ({ x: b.x - p, y: b.y - p, w: b.w + p * 2, h: b.h + p * 2 });
