"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useEditor, useQuickReactor } from "tldraw";
import type { BBox } from "@/lib/contracts";
import { LESSON_CARD_ID, type LessonItem, type SafeArea, type VisualStore } from "@/lib/canvas";
import { dragWithMomentum, type Pt } from "./drag";
import { NOTE_TONE } from "./noteTone";

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };
/** Wide screens: chat docked left, graphs in a panel on the right. Narrower: chat along the top, graphs in a sheet above the ask bar. */
const WIDE = "(min-width: 900px)";

/**
 * The tutor's things on top of the canvas, in three layers:
 * - marks on the page (a numbered outline round each explained term), moving with the page;
 * - the conversation: ONE chat for the whole document, in a panel fixed on screen (docked on the left on wide
 *   screens, along the top on narrow ones; drag it anywhere by its "∂raft" handle, double-click to dock it
 *   again). It never follows the canvas, so scrolling the page and scrolling the chat never fight: the wheel or
 *   a swipe over the chat scrolls the chat, anywhere else scrolls the page;
 * - graphs in their own panel.
 * Nothing here is ever wiped by a new circle; ✕ on the chat only hides it.
 */
export function TutorOverlay({ store }: { store: VisualStore }) {
  const editor = useEditor();
  const { items, gen, safe } = useSyncExternalStore(store.subscribe, store.get, store.get);
  const reduce = !!useReducedMotion();
  const wide = useMedia(WIDE);

  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const room = useSize(root);
  /** Where the student dropped the chat, in overlay pixels (null = docked). */
  const [pos, setPos] = useState<Pt | null>(null);
  /** The student hid the chat (✕). It's kept (still mounted), and comes back with the next circle, question or answer. */
  const [hidden, setHidden] = useState(false);
  /** Narrow screens: where the graph sheet starts, so the chat ends above it. */
  const [sheetTop, setSheetTop] = useState<number | null>(null);
  /** Follow the newest message only while the student is at the bottom; reading older messages isn't interrupted. */
  const atBottom = useRef(true);

  const lesson = items.find((i) => i.kind === "node" && i.id === LESSON_CARD_ID);
  const graphs = items.filter((i): i is Extract<LessonItem, { kind: "node" }> => i.kind === "node" && i.id !== LESSON_CARD_ID);
  // Explain cards are numbered 1, 2, 3... in the order they arrive; the chat numbers its note bubbles the same way.
  const numbers = new Map<string, number>();
  for (const i of items) if (i.kind === "note") numbers.set(i.id, numbers.size + 1);

  // Only the marks move with the camera: one transform per frame, no layout work, so the page scrolls smoothly.
  useQuickReactor(
    "tutor overlay camera",
    () => {
      const { x, y, z } = editor.getCamera();
      if (page.current) page.current.style.transform = `scale(${z}) translate(${x}px, ${y}px)`;
    },
    [editor],
  );

  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    window.addEventListener("draft:hide-chat", hide);
    window.addEventListener("draft:show-chat", show);
    return () => {
      window.removeEventListener("draft:hide-chat", hide);
      window.removeEventListener("draft:show-chat", show);
    };
  }, []);

  /** Narrow screens share the height with the graph sheet: measure where it starts. */
  const measureSheet = useCallback(() => {
    const d = dock.current, r = root.current;
    if (wide || !d || !r) { setSheetTop(null); return; }
    const b = d.getBoundingClientRect();
    setSheetTop(b.height ? b.top - r.getBoundingClientRect().top : null);
  }, [wide]);
  useLayoutEffect(() => {
    measureSheet();
    const d = dock.current;
    if (!d) return;
    const ro = new ResizeObserver(measureSheet);
    ro.observe(d);
    return () => ro.disconnect();
  }, [measureSheet, graphs.length]);

  // The chat grows as the tutor talks: keep the newest bubble in view, if the student was already there.
  // The scrolling part is the chat's message list ([data-chat-scroll]); the handle above it stays put.
  useLayoutEffect(() => {
    const list = chat.current?.querySelector<HTMLElement>("[data-chat-scroll]") ?? null;
    scroller.current = list as HTMLDivElement | null;
    if (!list) return;
    const track = () => { atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80; };
    const follow = () => { if (atBottom.current) list.scrollTo({ top: list.scrollHeight, behavior: reduce ? "auto" : "smooth" }); };
    list.addEventListener("scroll", track, { passive: true });
    const ro = new ResizeObserver(follow);
    for (const child of Array.from(list.children)) ro.observe(child);
    // Bubbles come and go as children: watch new ones too.
    const mo = new MutationObserver(() => { for (const child of Array.from(list.children)) ro.observe(child); follow(); });
    mo.observe(list, { childList: true });
    return () => { list.removeEventListener("scroll", track); ro.disconnect(); mo.disconnect(); };
  }, [reduce, lesson, gen]);

  // The wheel over the chat scrolls the chat, never the page underneath.
  useWheelStays(chat);

  const W = room.w || 1024, H = room.h || 768;
  const width = wide ? Math.round(Math.min(380, Math.max(300, W * 0.26))) : W - 24;
  const bottomEdge = Math.min(H - safe.bottom, sheetTop !== null ? sheetTop - 12 : Infinity);
  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, width: width + 24, maxHeight: Math.max(160, H - safe.bottom - pos.y) }
    : { left: Math.max(12, safe.left) - 12, top: safe.top - 12, width: width + 24, maxHeight: Math.max(140, bottomEdge - safe.top + 24) };

  /** Drag the chat by its handle (the "∂raft" pill); dropped near its dock, it docks again. */
  const grab = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const handle = target.closest<HTMLElement>("[data-drag-handle]");
    const el = chat.current, rootEl = root.current;
    if (!handle || target.closest("button") || !el || !rootEl || e.button !== 0) return;
    e.preventDefault();
    const r = rootEl.getBoundingClientRect(), b = el.getBoundingClientRect();
    let docking = false;
    dragWithMomentum(e.nativeEvent, {
      handle,
      root: rootEl,
      start: { x: b.left - r.left, y: b.top - r.top },
      reduce,
      bounds: () => ({ minX: 8, maxX: r.width - el.offsetWidth - 8, minY: 72, maxY: r.height - 64 }),
      onMove: (p) => { docking = false; setPos(p); },
      snap: (p) => {
        const home = { x: Math.max(12, safe.left) - 12, y: safe.top - 12 };
        if (Math.abs(p.x - home.x) < 48 && Math.abs(p.y - home.y) < 48) { docking = true; return home; }
        return p;
      },
      onSettle: (p) => setPos(docking ? null : p),
    });
  };

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[200] overflow-hidden" aria-live="polite">
      <div ref={page} className="absolute left-0 top-0 origin-top-left">
        <TermMarks items={items} numbers={numbers} reduce={reduce} />
      </div>

      {lesson && lesson.kind === "node" && (
        // Stays mounted while hidden, so the conversation is never lost.
        <motion.div
          ref={chat}
          className="absolute flex flex-col"
          style={{ ...style, visibility: hidden ? "hidden" : "visible", pointerEvents: hidden ? "none" : "auto" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: wide ? -24 : 0, y: wide ? 0 : -16 }}
          animate={hidden ? { opacity: 0, scale: 0.98 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={spring}
          onPointerDown={(e) => { e.stopPropagation(); grab(e); }}
          onDoubleClick={(e) => { if ((e.target as Element).closest("[data-drag-handle]")) setPos(null); }}
        >
          <div className="flex min-h-0 flex-1 flex-col" style={{ padding: 12 }}>
            <div key={gen} className="flex min-h-0 flex-1 flex-col">{lesson.node}</div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {hidden && lesson && (
          <motion.button
            key="show"
            type="button"
            onClick={() => setHidden(false)}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Show the conversation"
            className="app-glass app-press pointer-events-auto absolute flex items-center gap-2 rounded-full py-1 pl-1 pr-3.5"
            style={{ left: Math.max(12, safe.left), top: safe.top }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[0.8rem] font-semibold text-white">∂</span>
            <span className="text-[0.84rem] font-semibold text-text">Show chat</span>
          </motion.button>
        )}
      </AnimatePresence>

      <GraphPanel panelRef={dock} rootRef={root} graphs={graphs} wide={wide} safe={safe} reduce={reduce} onLayout={measureSheet} />
    </div>
  );
}

/* ───────────── Graph panel ───────────── */

/**
 * Graphs live apart from the conversation: a glass panel on the right on wide screens, a sheet above the
 * ask bar on narrow ones. It enters and leaves along the same edge, can be folded away, and opens again
 * when a new graph arrives or a "View graph" bubble is tapped. Drag it by its header to put it anywhere;
 * drop it back near its edge and it docks again.
 * It never scrolls: the graph's plot shrinks so the whole card fits (extras drop away when the panel is short),
 * and with several graphs it shows one at a time, with ‹ › to step between them (a new graph comes to the front).
 */
function GraphPanel({ panelRef, rootRef, graphs, wide, safe, reduce, onLayout }: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  graphs: Extract<LessonItem, { kind: "node" }>[];
  wide: boolean;
  safe: SafeArea;
  reduce: boolean;
  onLayout: () => void;
}) {
  const [open, setOpen] = useState(true);
  /** Where the student dropped the panel, in overlay pixels (null = docked). */
  const [pos, setPos] = useState<Pt | null>(null);
  const [shown, setShown] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const room = useSize(rootRef);
  const count = graphs.length;
  const index = Math.min(shown, Math.max(0, count - 1));
  const graph = graphs[index];
  const graphsNow = useRef(graphs);
  graphsNow.current = graphs;
  useEffect(() => { if (count) { setOpen(true); setShown(count - 1); } }, [count]);
  useEffect(() => {
    const show = (e: Event) => {
      setOpen(true);
      const id = (e as CustomEvent<string | undefined>).detail;
      const i = id ? graphsNow.current.findIndex((g) => g.id === id) : -1;
      if (i >= 0) setShown(i);
    };
    window.addEventListener("draft:show-graphs", show);
    return () => window.removeEventListener("draft:show-graphs", show);
  }, []);
  useLayoutEffect(onLayout, [onLayout, open, count, wide, pos, index]);
  useWheelStays(body);

  const from = wide ? { x: 40, y: 0 } : { x: 0, y: 40 };
  const width = wide ? "clamp(300px, 28vw, 420px)" : "calc(100% - 24px)";
  const H = room.h || 800;
  const sheetHeight = Math.min(H * 0.5, Math.max(H * 0.4, H - 480)); // shorter on phones
  const maxHeight = Math.round(pos
    ? (wide ? Math.max(260, H - pos.y - safe.bottom) : sheetHeight)
    : wide ? H - safe.top - safe.bottom + 64 : sheetHeight);
  /** Too short for the whole card at its usual size: drop the title, legend and drag hint. */
  const tight = maxHeight < 500;
  const position: React.CSSProperties = pos
    // Dropped somewhere: stay there (but never further right/down than leaves the header on screen).
    ? { left: `min(${pos.x}px, calc(100% - 140px))`, top: `min(${pos.y}px, calc(100% - 64px))`, width, maxHeight }
    : wide
      ? { top: safe.top, right: Math.max(12, safe.right), maxHeight, width }
      : { left: 12, right: 12, bottom: safe.bottom, maxHeight };
  const step = (by: number) => setShown(Math.min(count - 1, Math.max(0, index + by)));

  /** Drag by the header. A tap (under 6 px of movement) still folds the panel. */
  const grab = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = panelRef.current, rootEl = rootRef.current;
    if (!el || !rootEl || e.button !== 0) return;
    const r = rootEl.getBoundingClientRect(), b = el.getBoundingClientRect();
    let docking = false;
    dragWithMomentum(e.nativeEvent, {
      handle: e.currentTarget,
      root: rootEl,
      start: { x: b.left - r.left, y: b.top - r.top },
      threshold: 6,
      reduce,
      bounds: () => ({ minX: 8, maxX: r.width - el.offsetWidth - 8, minY: 72, maxY: r.height - 64 }),
      onMove: setPos, // the bubbles step aside as it moves (layout effect on pos)
      // Dropped near its home edge: glide back into the dock.
      snap: (p) => {
        if (wide && p.x + el.offsetWidth > r.width - Math.max(12, safe.right) - 56) {
          docking = true;
          return { x: r.width - Math.max(12, safe.right) - el.offsetWidth, y: safe.top };
        }
        if (!wide && p.y + el.offsetHeight > r.height - safe.bottom - 40) {
          docking = true;
          return { x: 12, y: r.height - safe.bottom - el.offsetHeight };
        }
        return p;
      },
      onSettle: (p) => setPos(docking ? null : p),
    });
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.aside
          ref={panelRef}
          aria-label="Graphs"
          className="app-glass pointer-events-auto absolute flex flex-col overflow-hidden rounded-[24px]"
          style={position}
          initial={reduce ? { opacity: 0 } : { opacity: 0, ...from }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, ...from }}
          transition={spring}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            onPointerDown={grab}
            aria-expanded={open}
            aria-label={`${count === 1 ? "Graph" : `${count} graphs`}: tap to ${open ? "fold" : "open"}, drag to move`}
            className="flex w-full cursor-grab touch-none flex-col items-stretch px-4 pb-3 pt-1.5 text-left active:cursor-grabbing"
          >
            {/* The grabber says "you can move this", like an iOS sheet */}
            <span aria-hidden className="mx-auto mb-1.5 h-[5px] w-9 rounded-full bg-[rgba(15,23,42,0.16)]" />
            <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-ink" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 3v18h18" /><path d="M6 16c3-8 6-8 9-3s4 2 6-4" />
            </svg>
            <span className="text-[0.92rem] font-semibold tracking-[-0.01em] text-text">{count === 1 ? "Graph" : `Graphs · ${count}`}</span>
            <svg viewBox="0 0 24 24" className={`ml-auto h-4 w-4 text-subtle transition-transform duration-200 ${open ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <path d={wide ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
            </svg>
            </span>
          </button>
          {open && count > 1 && (
            <div className="absolute bottom-2 right-10 flex items-center gap-0.5 text-[0.8rem] font-medium tabular-nums text-subtle">
              <PagerButton label="Previous graph" disabled={index === 0} onClick={() => step(-1)} d="M15 18l-6-6 6-6" />
              <span aria-live="polite" className="min-w-[2.6em] text-center">{index + 1} / {count}</span>
              <PagerButton label="Next graph" disabled={index === count - 1} onClick={() => step(1)} d="M9 6l6 6-6 6" />
            </div>
          )}
          </div>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="graphs"
                ref={body}
                className={`visual-fit ${tight ? "visual-tight" : ""} flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={spring}
              >
                {graph && (
                  <motion.div
                    key={graph.id}
                    className="flex min-h-0 flex-1 flex-col"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={spring}
                  >
                    {graph.node as ReactNode}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ───────────── Marks on the page ───────────── */

/**
 * On the page: a soft tinted outline around each explained term, with a numbered badge on its corner.
 * The note bubble with the same number explains it, so nothing has to cross the page to connect them.
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

/* ───────────── Small helpers ───────────── */

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const m = matchMedia(query);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => matchMedia(query).matches,
    () => true,
  );
}

function PagerButton({ label, disabled, onClick, d }: { label: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full text-ink transition-[transform,opacity] duration-150 active:scale-90 active:bg-[rgba(15,23,42,0.06)] disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
    </button>
  );
}

/** The element's size in pixels, kept up to date. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Wheel events inside this element scroll it, instead of reaching the canvas (which would pan the page). */
function useWheelStays(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const keep = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", keep, { passive: true });
    return () => el.removeEventListener("wheel", keep);
  });
}
