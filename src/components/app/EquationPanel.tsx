"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEditor, useValue, type TLShape, type TLShapeId } from "tldraw";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { CanvasEquation, CanvasHandle } from "@/lib/canvas";
import { groupEquations, selectedInkIds } from "@/lib/canvas/equations";
import { strokePoints } from "@/lib/canvas/context";
import { FolderIcon, LayersIcon } from "./icons";

type Layer = { id: string; label: string; shapeIds: string[]; equation?: CanvasEquation; group?: TLShape; depth: number };
type Modifiers = { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

export function EquationPanel({ api, reading, onNotice }: {
  api: CanvasHandle; reading: boolean; onNotice: (message: string | null) => void;
}) {
  const editor = useEditor();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [revision, setRevision] = useState(0);
  const anchor = useRef<string | null>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const toggle = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => api.onEvent((event) => {
    if (event.type === "line") setRevision((value) => value + 1);
  }), [api]);
  useEffect(() => {
    if (open) (rows.current.values().next().value ?? close.current)?.focus();
  }, [open]);
  const equations = useValue("equations", () => api.getEquations(), [api, revision, reading]);
  const selected = useValue("selected equation ink", () => new Set(selectedInkIds(editor)), [editor]);
  const blocks = useValue("equation blocks", () => editor.getCurrentPageShapes().filter((shape) =>
    shape.type === "group" && shape.meta.kind === "equation-block" &&
    !editor.getShapeAncestors(shape).some((parent) => parent.meta.kind === "equation-block")), [editor]);
  const members = new Map(blocks.map((block) => {
    const children = editor.getShapeAndDescendantIds([block.id]);
    return [block.id, equations.filter((line) => line.shapeIds.some((id) => children.has(id as TLShapeId)))];
  }));
  const chosen = equations.filter((line) => line.shapeIds.every((id) => selected.has(id as TLShapeId)));
  const selectedBlocks = blocks.filter((block) => members.get(block.id)!.every((line) => chosen.includes(line)));
  const alreadyGrouped = selectedBlocks.some((block) => members.get(block.id)!.length === chosen.length);
  const layers: Layer[] = [];
  const seen = new Set<string>();
  const leaf = (equation: CanvasEquation, depth: number): Layer => ({
    id: equation.shapeIds.toSorted().join(","), label: "Equation " + (equations.indexOf(equation) + 1),
    shapeIds: equation.shapeIds, equation, depth,
  });
  for (const equation of equations) {
    const block = blocks.find((block) => members.get(block.id)!.includes(equation));
    if (!block) layers.push(leaf(equation, 1));
    else if (!seen.has(block.id)) {
      seen.add(block.id);
      const children = members.get(block.id)!;
      layers.push({ id: block.id, label: "Group " + (blocks.indexOf(block) + 1),
        shapeIds: children.flatMap((line) => line.shapeIds), group: block, depth: 1 });
      if (expanded.has(block.id)) layers.push(...children.map((line) => leaf(line, 2)));
    }
  }
  const select = (ids: string[]) => { editor.setCurrentTool("select"); editor.select(...ids as TLShapeId[]); };
  const choose = (layer: Layer, event: Modifiers) => {
    const start = layers.findIndex((row) => row.id === anchor.current);
    const end = layers.indexOf(layer);
    const additive = event.ctrlKey || event.metaKey;
    if (event.shiftKey && start >= 0) {
      const ids = new Set<string>(additive ? selected : []);
      for (const row of layers.slice(Math.min(start, end), Math.max(start, end) + 1)) for (const id of row.shapeIds) ids.add(id);
      select([...ids]);
    } else if (additive) {
      const ids = new Set<string>(selected);
      const remove = layer.shapeIds.every((id) => ids.has(id));
      for (const id of layer.shapeIds) { if (remove) ids.delete(id); else ids.add(id); }
      select([...ids]); anchor.current = layer.id;
    } else { select(layer.group ? [layer.group.id] : layer.shapeIds); anchor.current = layer.id; }
    setFocusId(layer.id);
  };
  const expand = (id: string) => setExpanded((previous) => {
    const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const dismiss = () => { setOpen(false); requestAnimationFrame(() => toggle.current?.focus()); };
  const act = (action: () => void) => {
    try { action(); onNotice(null); }
    catch (error) { onNotice(error instanceof Error ? error.message : "Couldn't update the selection."); }
  };
  const onRowKey = (event: KeyboardEvent<HTMLDivElement>, layer: Layer) => {
    const index = layers.indexOf(layer);
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(layers.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = layers.length - 1;
    else if (event.key === "ArrowRight" && layer.group) {
      if (!expanded.has(layer.id)) expand(layer.id); else next = Math.min(layers.length - 1, index + 1);
    } else if (event.key === "ArrowLeft") {
      if (layer.group && expanded.has(layer.id)) expand(layer.id);
      else if (layer.depth === 2) { while (next > 0 && layers[next].depth === 2) next--; }
    } else if (event.key === "Enter" || event.key === " ") choose(layer, event);
    else return;
    event.preventDefault();
    if (next !== index) { choose(layers[next], event); rows.current.get(layers[next].id)?.focus(); }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[310]" onPointerDown={(event) => event.stopPropagation()}
      onKeyDownCapture={editor.markEventAsHandled} onKeyUpCapture={editor.markEventAsHandled}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape" && open) { event.preventDefault(); dismiss(); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
          event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo();
        }
      }}>
      <button ref={toggle} type="button" aria-label="Equation layers" aria-expanded={open} aria-controls="equation-layers"
        onClick={() => open ? dismiss() : setOpen(true)}
        className={`canvas-panel app-press pointer-events-auto absolute right-3 top-20 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-text ${open ? "invisible" : ""}`}>
        <LayersIcon className="h-5 w-5" /> Layers <span className="text-xs text-muted">{equations.length}</span>
      </button>
      <AnimatePresence>
        {open && <motion.aside id="equation-layers" aria-label="Equation layers panel"
          initial={{ opacity: 0, x: reducedMotion ? 0 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reducedMotion ? 0 : 16 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="canvas-panel pointer-events-auto absolute bottom-40 right-3 top-20 flex w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl text-sm">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-text"><LayersIcon className="h-5 w-5" /><h2>Layers</h2>
              <span className="text-xs font-normal text-muted">{equations.length} equations</span></div>
            <button ref={close} type="button" aria-label="Close equation layers" onClick={dismiss}
              className="app-press flex h-8 w-8 items-center justify-center rounded-lg text-xl text-muted">×</button>
          </header>
          <div role="tree" aria-label="Equations" aria-multiselectable="true" className="min-h-0 flex-1 overflow-y-auto py-1">
            {!layers.length && <p className="px-4 py-6 text-muted">Write on the canvas. Each equation will appear here.</p>}
            {layers.map((layer, i) => {
              const checked = layer.shapeIds.every((id) => selected.has(id as TLShapeId));
              return <div key={layer.id} role="treeitem" aria-label={layer.group ? "Select block " + (blocks.indexOf(layer.group) + 1) : "Select " + layer.label.toLowerCase()}
                aria-selected={checked} aria-level={layer.depth} aria-expanded={layer.group ? expanded.has(layer.id) : undefined}
                tabIndex={focusId === layer.id || (!layers.some((row) => row.id === focusId) && i === 0) ? 0 : -1}
                ref={(node) => { if (node) rows.current.set(layer.id, node); else rows.current.delete(layer.id); }}
                onFocus={() => setFocusId(layer.id)} onClick={(event) => choose(layer, event)} onKeyDown={(event) => onRowKey(event, layer)}
                className={`equation-layer flex min-h-16 cursor-default items-center gap-3 border-l-[3px] py-2 pr-4 ${layer.depth === 2 ? "pl-8" : "pl-3"} ${checked ? "border-ink bg-ink-wash" : "border-transparent hover:bg-black/[0.025]"}`}>
                {layer.group ? <>
                  <button type="button" tabIndex={-1} aria-label={`${expanded.has(layer.id) ? "Collapse" : "Expand"} group ${blocks.indexOf(layer.group) + 1}`}
                    onClick={(event) => { event.stopPropagation(); expand(layer.id); }} className="app-press flex h-8 w-5 items-center justify-center text-muted">
                    <span aria-hidden>{expanded.has(layer.id) ? "▾" : "▸"}</span>
                  </button>
                  <FolderIcon className="h-7 w-7 shrink-0 text-ink" />
                  <div className="min-w-0"><p className="font-semibold text-text">{layer.label}</p><p className="mt-0.5 text-xs text-muted">{members.get(layer.group.id)!.length} equations</p></div>
                </> : <>
                  <InkThumbnail equation={layer.equation!} />
                  <div className="min-w-0 flex-1"><p className="mb-1 text-xs text-muted">{layer.label}</p><EquationMath latex={layer.equation!.latex} /></div>
                </>}
              </div>;
            })}
          </div>
          <footer className="border-t border-line px-4 py-3">
            <p className="mb-3 text-xs text-muted">Shift-click a range · Ctrl/⌘-click to toggle</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Group equations" disabled={chosen.length < 2 || alreadyGrouped}
                onClick={() => act(() => groupEquations(editor, chosen))}
                className="app-press flex items-center gap-2 rounded-lg bg-ink px-3 py-2 font-semibold text-white disabled:opacity-40"><FolderIcon className="h-4 w-4" /> Group</button>
              <button type="button" aria-label="Ungroup equations" disabled={!selectedBlocks.length}
                onClick={() => act(() => { editor.markHistoryStoppingPoint("ungroup equations"); editor.ungroupShapes(selectedBlocks.map((block) => block.id)); })}
                className="app-press rounded-lg border border-line px-3 py-2 disabled:opacity-40">Ungroup</button>
              <span className="ml-auto text-xs text-muted">{chosen.length} selected</span>
            </div>
          </footer>
        </motion.aside>}
      </AnimatePresence>
    </div>
  );
}

function InkThumbnail({ equation }: { equation: CanvasEquation }) {
  const editor = useEditor();
  const box = equation.bbox;
  const width = Math.max(box.w, box.h) / 40;
  return <svg aria-label="Handwriting preview" role="img" className="h-11 w-14 shrink-0 rounded-md border border-line bg-white"
    viewBox={`${box.x - width * 2} ${box.y - width * 2} ${box.w + width * 4} ${box.h + width * 4}`}>
    {equation.shapeIds.map((id) => {
      const shape = editor.getShape(id as TLShapeId);
      return shape?.type === "draw" ? <polyline key={id} points={strokePoints(editor, shape).map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none" stroke="#1d1d1f" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null;
    })}
  </svg>;
}

function EquationMath({ latex }: { latex: string | null }) {
  const html = useMemo(() => latex === null ? "" : katex.renderToString(latex, {
    throwOnError: false, trust: false, maxExpand: 100, maxSize: 10, displayMode: true,
  }), [latex]);
  return latex === null ? <span className="text-xs text-muted">Not read yet</span>
    : <div className="equation-layer-math overflow-x-auto py-1 text-base text-text" dangerouslySetInnerHTML={{ __html: html }} />;
}
