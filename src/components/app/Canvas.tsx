"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import {
  AssetRecordType,
  Box,
  createShapeId,
  Tldraw,
  useEditor,
  type Editor,
  type TLComponents,
} from "tldraw";
import "tldraw/tldraw.css";
import { ChevronLeftIcon, FitIcon } from "./icons";
import { loadPages, PAGE_WIDTH } from "./loadPages";
import { PaperBackground } from "./PaperBackground";
import { Toolbar } from "./Toolbar";
import { PAPERS, type DocSource, type Paper } from "./types";
import { createCanvasApi, type CanvasHandle, type InkRecognizer } from "@/lib/canvas";
import type { CircleContext } from "@/lib/contracts";
import { TutorInkShapeUtil } from "./TutorInkShape";
import { VisualShapeUtil } from "./VisualShape";
import { CanvasFeedback, type CanvasVoiceControl } from "./CanvasFeedback";
import { EquationPanel } from "./EquationPanel";
import "./canvas.css";

const PAGE_GAP = 32;
const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };
const shapeUtils = [TutorInkShapeUtil, VisualShapeUtil];

type Status = { state: "ready" } | { state: "loading"; label: string } | { state: "error"; message: string };

export type CanvasProps = {
  source: DocSource;
  onExit: () => void;
  onReady?: (api: CanvasHandle, editor: Editor) => void | (() => void);
  recogniseInk?: InkRecognizer;
  voice?: CanvasVoiceControl;
};

export function Canvas({ source, onExit, onReady, recogniseInk, voice }: CanvasProps) {
  const [paper, setPaper] = useState<Paper>(source.paper);
  const [status, setStatus] = useState<Status>(
    source.kind === "file" ? { state: "loading", label: "Opening your document…" } : { state: "ready" },
  );
  const [api, setApi] = useState<CanvasHandle | null>(null);
  const [context, setContext] = useState<CircleContext | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const isFile = source.kind === "file";
  const title = isFile ? source.file.name.replace(/\.[^.]+$/, "") : "Untitled";
  const tint = isFile ? "#f3f3f6" : "#ffffff";

  const components = useMemo<TLComponents>(
    () => ({ Background: () => <PaperBackground paper={paper} tint={tint} /> }),
    [paper, tint],
  );

  const onMount = useCallback(
    (editor: Editor) => {
      let cancelled = false;
      editor.setCurrentTool("draw");
      editor.user.updateUserPreferences({ isSnapMode: false });
      const canvasApi = createCanvasApi(editor, { recogniseInk, onError: setNotice, onContext: setContext, onReading: setReading });
      setApi(canvasApi);
      const disconnect = onReady?.(canvasApi, editor);
      const cleanup = () => {
        cancelled = true;
        disconnect?.();
        canvasApi.dispose();
      };

      if (source.kind === "blank") {
        editor.setCamera({ x: 0, y: 0, z: 1 });
        return cleanup;
      }

      loadPages(source.file)
        .then((pages) => {
          if (cancelled) return;
          let y = 0;
          editor.run(
            () => {
              pages.forEach((page, i) => {
                const assetId = AssetRecordType.createId();
                editor.createAssets([
                  {
                    id: assetId,
                    typeName: "asset",
                    type: "image",
                    meta: {},
                    props: {
                      w: page.w,
                      h: page.h,
                      name: `page-${i + 1}`,
                      src: page.src,
                      mimeType: "image/png",
                      isAnimated: false,
                    },
                  },
                ]);
                editor.createShape({
                  id: createShapeId(`page-${i + 1}`),
                  type: "image",
                  x: (PAGE_WIDTH - page.w) / 2,
                  y,
                  isLocked: true,
                  meta: { kind: "page", page: i + 1, textItems: page.textItems },
                  props: { assetId, w: page.w, h: page.h },
                });
                y += page.h + PAGE_GAP;
              });
            },
            // Pages are the document itself: never part of undo/redo.
            { history: "ignore" },
          );
          fitWidth(editor, pages[0]?.h ?? 1000);
          setStatus({ state: "ready" });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setStatus({
            state: "error",
            message:
              err instanceof Error && err.message === "unsupported"
                ? "This file type isn't supported yet. Try a PDF or an image."
                : err instanceof Error && /^(Please choose|One page)/.test(err.message)
                  ? err.message : "We couldn't open this file. It may be damaged or password-protected.",
          });
        });
      return cleanup;
    },
    [source, onReady, recogniseInk],
  );

  return (
    <div className="draft-canvas fixed inset-0">
      <Tldraw hideUi components={components} shapeUtils={shapeUtils} onMount={onMount}>
        <TopBar title={title} paper={paper} onPaper={setPaper} onExit={onExit} />
        <Toolbar />
        {api && <CanvasFeedback api={api} context={context} voice={voice} reading={reading} notice={notice} onNotice={setNotice} />}
        {api && <EquationPanel api={api} reading={reading} onNotice={setNotice} />}
      </Tldraw>

      <AnimatePresence>
        {status.state !== "ready" && (
          <motion.div
            className="absolute inset-0 z-[400] flex items-center justify-center bg-white/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="surface flex max-w-sm flex-col items-center gap-4 rounded-2xl px-8 py-7 text-center">
              {status.state === "loading" ? (
                <>
                  <span className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-ink/20 border-t-ink" />
                  <p className="text-[0.95rem] font-medium text-text">{status.label}</p>
                </>
              ) : (
                <>
                  <p className="text-[1rem] font-semibold text-text">Couldn&rsquo;t open the file</p>
                  <p className="text-[0.9rem] leading-[1.5] text-muted">{status.message}</p>
                  <button
                    type="button"
                    onClick={onExit}
                    className="pressable btn-primary rounded-full px-5 py-2.5 text-[0.9rem] font-semibold"
                  >
                    Choose another
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Zoom so the page width fills the screen comfortably, top of page 1 in view. */
function fitWidth(editor: Editor, firstPageHeight: number) {
  const viewport = editor.getViewportScreenBounds();
  const margin = viewport.w < 700 ? 16 : 96;
  const z = Math.min(1.25, (viewport.w - margin * 2) / PAGE_WIDTH);
  const visibleH = viewport.h / z;
  editor.zoomToBounds(new Box(0, -72 / z, PAGE_WIDTH, Math.min(firstPageHeight, visibleH)), {
    targetZoom: z,
    inset: 0,
  });
}

function TopBar({
  title,
  paper,
  onPaper,
  onExit,
}: {
  title: string;
  paper: Paper;
  onPaper: (p: Paper) => void;
  onExit: () => void;
}) {
  const editor = useEditor();

  const leave = () => {
    const hasInk = editor.getCurrentPageShapes().some((s) => s.meta?.kind !== "page");
    if (!hasInk || window.confirm("Leave this document? Your writing isn't saved yet.")) onExit();
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[300] flex items-start justify-between gap-3 px-3 pt-[max(env(safe-area-inset-top),0.75rem)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="app-glass pointer-events-auto flex min-w-0 items-center gap-1 rounded-2xl p-1.5 pr-4">
        <button
          type="button"
          onClick={leave}
          aria-label="Back to documents"
          className="app-press flex h-10 w-10 items-center justify-center rounded-xl text-ink"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <span className="truncate text-[0.95rem] font-semibold tracking-[-0.01em] text-text">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="app-glass pointer-events-auto relative hidden items-center rounded-2xl p-1.5 sm:flex"
          role="radiogroup"
          aria-label="Paper"
        >
          {PAPERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={paper === p.id}
              onClick={() => onPaper(p.id)}
              className={`app-press relative h-10 rounded-xl px-3.5 text-[0.85rem] font-semibold transition-colors duration-200 ${
                paper === p.id ? "text-ink" : "text-[#3a3a3c]"
              }`}
            >
              {paper === p.id && (
                <motion.span layoutId="paper-active" className="absolute inset-0 rounded-xl bg-ink-wash" transition={spring} />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>

        <PaperMenu paper={paper} onPaper={onPaper} />

        <button
          type="button"
          aria-label="Fit to screen"
          title="Fit to screen"
          onClick={() => editor.zoomToFit({ animation: { duration: 320 } })}
          className="app-glass app-press pointer-events-auto flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl text-[#3a3a3c]"
        >
          <FitIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Compact paper picker for phones. */
function PaperMenu({ paper, onPaper }: { paper: Paper; onPaper: (p: Paper) => void }) {
  return (
    <label className="app-glass pointer-events-auto relative flex h-[3.25rem] items-center rounded-2xl px-3 sm:hidden">
      <span className="sr-only">Paper</span>
      <select
        value={paper}
        onChange={(e) => onPaper(e.target.value as Paper)}
        className="appearance-none bg-transparent pr-1 text-[0.85rem] font-semibold text-ink outline-none"
      >
        {PAPERS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
