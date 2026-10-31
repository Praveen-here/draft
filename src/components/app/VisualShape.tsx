"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, useEditor, type Editor, type TLShape } from "tldraw";

type VisualProps = { w: number; h: number; visualId: string };
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap { "tutor-visual": VisualProps }
}
type VisualShape = TLShape<"tutor-visual">;
type VisualStore = { nodes: Map<string, ReactNode>; listeners: Set<() => void> };
const stores = new WeakMap<Editor, VisualStore>();

function visualStore(editor: Editor): VisualStore {
  let store = stores.get(editor);
  if (!store) {
    store = { nodes: new Map(), listeners: new Set() };
    stores.set(editor, store);
  }
  return store;
}

/** React nodes stay outside tldraw's serialised document records. */
export function setVisualNode(editor: Editor, id: string, node: ReactNode) {
  const store = visualStore(editor);
  if (node === null) store.nodes.delete(id);
  else store.nodes.set(id, node);
  store.listeners.forEach((listener) => listener());
}

export function clearVisualNodes(editor: Editor) {
  const store = visualStore(editor);
  store.nodes.clear();
  store.listeners.forEach((listener) => listener());
}

export class VisualShapeUtil extends BaseBoxShapeUtil<VisualShape> {
  static override type = "tutor-visual" as const;
  static override props = { w: T.positiveNumber, h: T.positiveNumber, visualId: T.string };
  override getDefaultProps(): VisualProps { return { w: 360, h: 260, visualId: "" }; }
  override canEdit() { return false; }
  override canResize() { return false; }
  override getIndicatorPath() { return undefined; }
  override component(shape: VisualShape) { return <VisualContent shape={shape} />; }
}

function VisualContent({ shape }: { shape: VisualShape }) {
  const editor = useEditor();
  const store = visualStore(editor);
  const node = useSyncExternalStore(
    (listener) => { store.listeners.add(listener); return () => { store.listeners.delete(listener); }; },
    () => store.nodes.get(shape.props.visualId),
    () => null,
  );
  return (
    <HTMLContainer className="canvas-visual" style={{ width: shape.props.w, height: shape.props.h }}
      onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()} role="group" aria-label="Tutor visual">
      {node}
    </HTMLContainer>
  );
}
