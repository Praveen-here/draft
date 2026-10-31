"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useEditor, useQuickReactor } from "tldraw";
import type { BBox } from "@/lib/contracts";
import { LESSON_CARD_ID, type LessonItem, type SafeArea, type VisualStore } from "@/lib/canvas";
import { dragWithMomentum, type Pt } from "./drag";
import { NOTE_TONE } from "./noteTone";

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };
/** Space between the circle and its bubbles, in screen pixels. */
const GAP = 14;
/** Wide screens get a graph panel on the right; narrower ones a sheet above the ask bar. */
const WIDE = "(min-width: 900px)";

/**
 * The tutor's things on top of the canvas, in three layers:
 * - marks on the page (a numbered outline round each explained term), moving with the page;
 * - the lesson thread as message bubbles floating beside the circle, placed in screen space so their size
 *   follows the screen, not the zoom, and moved on every camera change so they stay with the circle;
 * - graphs in their own panel, apart from the conversation.
 */
export function TutorOverlay({ store }: { store: VisualStore }) {
  const editor = useEditor();
  const { anchor, items, gen, safe } = useSyncExternalStore(store.subscribe, store.get, store.get);
  const reduce = !!useReducedMotion();
  const wide = useMedia(WIDE);

  const root = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const bubbles = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const live = useRef({ anchor, safe });
  live.current = { anchor, safe };
  /** Where the student dragged the thread, as an offset from the circle's top-left (null = place it for them). */
  const pinned = useRef<Pt | null>(null);
  const dragging = useRef(false);
  /** The thread's current top-left, in overlay pixels. */
  const at = useRef<Pt>({ x: 0, y: 0 });
  /** Room it may use: everything on screen except the bars. */
  const limits = useRef({ left: 0, right: 0, top: 0, bottom: 0, w: 0, h: 0 });

  const lesson = items.find((i) => i.kind === "node" && i.id === LESSON_CARD_ID);
  const graphs = items.filter((i): i is Extract<LessonItem, { kind: "node" }> => i.kind === "node" && i.id !== LESSON_CARD_ID);
  // Explain cards are numbered 1, 2, 3... in the order they arrive; the thread numbers its note bubbles the same way.
  const numbers = new Map<string, number>();
  for (const i of items) if (i.kind === "note") numbers.set(i.id, numbers.size + 1);

  /** Put the bubbles beside the circle, on whichever side has room, clear of the bars and the graph panel. */
  const place = useCallback(() => {
    const el = bubbles.current, list = scroller.current, box = root.current;
    const { anchor: a, safe: s } = live.current;
    if (!el || !list || !box || !a) return;
    const screen = editor.getViewportScreenBounds();
    const W = screen.w, H = screen.h;
    const p1 = editor.pageToViewport({ x: a.x, y: a.y });
    const p2 = editor.pageToViewport({ x: a.x + a.w, y: a.y + a.h });
    const left = s.left, right = W - s.right, top = s.top, bottom = H - s.bottom;
    const w = Math.max(220, Math.min(W < 640 ? W - 24 : Math.min(380, Math.max(280, W * 0.3)), right - left));
    const content = (list.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    const clampX = (x: number) => Math.min(Math.max(x, left), right - w);
    // A moved thread may shrink to ~200 px (it scrolls inside), so it can go anywhere on screen.
    limits.current = { left, right, top, bottom, w, h: Math.min(content, 200, bottom - top) };

    // The graph panel is an obstacle: bubbles go round it, never under it.
    const d = dock.current?.getBoundingClientRect(), r = box.getBoundingClientRect();
    const P = d && d.width ? { l: d.left - r.left, r: d.right - r.left, t: d.top - r.top, b: d.bottom - r.top } : null;
    const hits = (x: number, y: number, h: number) => !!P && x < P.r + 8 && x + w > P.l - 8 && y < P.b + 8 && y + h > P.t - 8;

    // Dragged by the student: keep their offset from the circle (so it still follows the page), on screen,
    // and stepping out from under the graph panel if the panel lands on it.
    if (pinned.current) {
      let x = p1.x + pinned.current.x, y = p1.y + pinned.current.y;
      if (!dragging.current) {
        x = clampX(x);
        y = Math.min(Math.max(y, top), bottom - limits.current.h);
        if (P && hits(x, y, limits.current.h)) x = Math.max(left, Math.min(x, P.l - 12 - w));
      }
      at.current = { x, y };
      el.style.transition = "none";
      el.style.width = `${w}px`;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      list.style.maxHeight = `${Math.max(120, bottom - Math.max(y, top))}px`;
      return;
    }

    let MIN = 160; // smallest useful height for the thread; relaxed below when space is tight

    /** A spot at x, as near yWanted as fits between minY and maxY, stepping above or below the panel if needed. */
    const fit = (side: string, x: number, yWanted: number, minY: number, maxY: number) => {
      if (x < left - 0.5 || x + w > right + 0.5 || maxY - minY < Math.min(content, MIN)) return null;
      const h = Math.min(content, maxY - minY);
      const y = Math.min(Math.max(yWanted, minY), maxY - h);
      if (!hits(x, y, h)) return { side, x, y, room: maxY - minY };
      if (!P) return null;
      if (maxY - (P.b + 12) >= Math.min(content, MIN)) { // below the panel
        const yb = Math.max(P.b + 12, minY), hb = Math.min(content, maxY - yb);
        if (!hits(x, yb, hb)) return { side, x, y: yb, room: maxY - yb };
      }
      if (P.t - 12 - minY >= Math.min(content, MIN)) { // above the panel
        const ha = Math.min(content, P.t - 12 - minY), ya = Math.max(minY, Math.min(yWanted, P.t - 12 - ha));
        if (!hits(x, ya, ha)) return { side, x, y: ya, room: P.t - 12 - minY };
      }
      return null;
    };
    const around = () =>
      fit("right", p2.x + GAP, p1.y - 6, top, bottom) ??
      fit("left", p1.x - GAP - w, p1.y - 6, top, bottom) ??
      fit("below", clampX(p1.x), p2.y + GAP, Math.max(top, p2.y + GAP), bottom) ??
      fit("above", clampX(p1.x), p1.y - GAP - content, top, Math.min(bottom, p1.y - GAP)) ??
      (P ? fit("below-left", Math.max(left, Math.min(clampX(p1.x), P.l - 12 - w)), p2.y + GAP, Math.max(top, p2.y + GAP), bottom) : null);
    // Never cover the circle itself: with little space, take a smaller spot around it (the thread scrolls),
    // and only as a last resort sit just under it, over whatever is there.
    const first = around();
    MIN = 96;
    const spot = first ?? around() ?? {
      side: "fallback",
      x: clampX(p1.x),
      y: Math.min(Math.max(p2.y + GAP, top), bottom - 96),
      room: Math.max(96, bottom - Math.max(p2.y + GAP, top)),
    };

    // Following the camera is instant; moving to another side (e.g. the graph panel opened) glides there.
    const moved = el.dataset.side !== undefined && el.dataset.side !== spot.side && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.dataset.side = spot.side;
    el.style.transition = moved ? "transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    at.current = { x: spot.x, y: spot.y };
    el.style.width = `${w}px`;
    el.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
    list.style.maxHeight = `${Math.max(120, spot.room)}px`;
  }, [editor]);

  // A new problem places its thread fresh.
  useEffect(() => { pinned.current = null; }, [gen]);

  /** Drag the thread by its handle (the "∂raft" pill). Double-click the handle to let it place itself again. */
  const grabThread = (e: PointerEvent) => {
    const target = e.target as Element;
    const handle = target.closest<HTMLElement>("[data-drag-handle]");
    const a = live.current.anchor;
    if (!handle || target.closest("button") || !root.current || !a || e.button !== 0) return;
    e.preventDefault();
    const circle = () => editor.pageToViewport({ x: a.x, y: a.y });
    dragWithMomentum(e, {
      handle,
      root: root.current,
      start: at.current,
      reduce,
      bounds: () => {
        const l = limits.current;
        return { minX: l.left, maxX: l.right - l.w, minY: l.top, maxY: l.bottom - l.h };
      },
      onStart: () => { dragging.current = true; },
      onMove: (p) => {
        const c = circle();
        pinned.current = { x: p.x - c.x, y: p.y - c.y };
        place();
      },
      onSettle: () => { dragging.current = false; place(); },
    });
  };

  // Follow the camera straight on the DOM, in the same frame as the canvas: no React render per scroll frame.
  useQuickReactor(
    "tutor overlay camera",
    () => {
      const { x, y, z } = editor.getCamera();
      if (page.current) page.current.style.transform = `scale(${z}) translate(${x}px, ${y}px)`;
      place();
    },
    [editor, place],
  );
  useLayoutEffect(place, [place, anchor, safe, items, wide]);
  useEffect(() => {
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  // The thread grows as the tutor talks: re-place it, and keep the newest bubble in view.
  useLayoutEffect(() => {
    const list = scroller.current;
    const content = list?.firstElementChild;
    if (!list || !content) return;
    const ro = new ResizeObserver(() => {
      place();
      list.scrollTo({ top: list.scrollHeight, behavior: reduce ? "auto" : "smooth" });
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [place, reduce, lesson]);

  // The wheel scrolls the thread or the graph panel, not the page underneath.
  useWheelStays(scroller);

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[200] overflow-hidden" aria-live="polite">
      <div ref={page} className="absolute left-0 top-0 origin-top-left">
        <TermMarks items={items} numbers={numbers} reduce={reduce} />
      </div>

      <div ref={bubbles} className="absolute left-0 top-0" style={{ width: 0 }}>
        <AnimatePresence>
          {lesson && lesson.kind === "node" && (
            <motion.div
              key={gen}
              initial={{ opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              transition={{ duration: 0.22 }}
              style={{ transformOrigin: "top left" }}
            >
              <div
                ref={scroller}
                className="pointer-events-auto overflow-y-auto overscroll-contain [scrollbar-width:none]"
                style={{ margin: -12, padding: 12, maskImage: FADE, WebkitMaskImage: FADE }}
                onPointerDown={(e) => { e.stopPropagation(); grabThread(e.nativeEvent); }}
                onDoubleClick={(e) => {
                  if (!(e.target as Element).closest("[data-drag-handle]")) return;
                  pinned.current = null;
                  if (bubbles.current) bubbles.current.dataset.side = "moved"; // glide back
                  place();
                }}
              >
                <div>{lesson.node}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GraphPanel panelRef={dock} rootRef={root} graphs={graphs} wide={wide} safe={safe} reduce={reduce} onLayout={place} />
    </div>
  );
}

/** Fade the thread's top edge when older bubbles scroll under it. */
const FADE = "linear-gradient(to bottom, transparent 0, transparent 9px, #000 14px, #000 100%)";

/* ───────────── Graph panel ───────────── */

/**
 * Graphs live apart from the conversation: a glass panel on the right on wide screens, a sheet above the
 * ask bar on narrow ones. It enters and leaves along the same edge, can be folded away, and opens again
 * when a new graph arrives or a "View graph" bubble is tapped. Drag it by its header to put it anywhere;
 * drop it back near its edge and it docks again.
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
  const body = useRef<HTMLDivElement>(null);
  const count = graphs.length;
  useEffect(() => { if (count) setOpen(true); }, [count]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("draft:show-graphs", show);
    return () => window.removeEventListener("draft:show-graphs", show);
  }, []);
  useLayoutEffect(onLayout, [onLayout, open, count, wide, pos]);
  useWheelStays(body);

  const from = wide ? { x: 40, y: 0 } : { x: 0, y: 40 };
  const width = wide ? "clamp(300px, 28vw, 420px)" : "calc(100% - 24px)";
  const sheetHeight = "min(38vh, max(30vh, 100vh - 520px))"; // shorter on phones
  const position: React.CSSProperties = pos
    // Dropped somewhere: stay there (but never further right/down than leaves the header on screen).
    ? { left: `min(${pos.x}px, calc(100% - 140px))`, top: `min(${pos.y}px, calc(100% - 64px))`, width, maxHeight: wide ? `calc(100% - ${pos.y + safe.bottom}px)` : sheetHeight }
    : wide
      ? { top: safe.top, right: Math.max(12, safe.right), maxHeight: `calc(100% - ${safe.top + safe.bottom - 64}px)`, width }
      : { left: 12, right: 12, bottom: safe.bottom, maxHeight: sheetHeight };

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
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            onPointerDown={grab}
            aria-expanded={open}
            aria-label={`${count === 1 ? "Graph" : `${count} graphs`}: tap to ${open ? "fold" : "open"}, drag to move`}
            className="flex shrink-0 cursor-grab touch-none flex-col items-stretch px-4 pb-3 pt-1.5 text-left active:cursor-grabbing"
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
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="graphs"
                ref={body}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-width:thin]"
                initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={spring}
              >
                <div className="flex flex-col gap-3">
                  <AnimatePresence initial={true}>
                    {graphs.map((g) => (
                      <motion.div
                        key={g.id}
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={spring}
                      >
                        {g.node as ReactNode}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
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
