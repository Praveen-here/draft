"use client";

import { motion } from "motion/react";
import { DefaultColorStyle, DefaultSizeStyle, useEditor, useValue } from "tldraw";
import type { ReactNode } from "react";
import { EraserIcon, HighlighterIcon, PenIcon, RedoIcon, SelectIcon, UndoIcon } from "./icons";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

const TOOLS = [
  { id: "select", label: "Select and move", icon: SelectIcon },
  { id: "draw", label: "Pen", icon: PenIcon },
  { id: "highlight", label: "Highlighter", icon: HighlighterIcon },
  { id: "eraser", label: "Eraser", icon: EraserIcon },
] as const;

const COLORS = [
  { id: "black", label: "Black", swatch: "#1d1d1f" },
  { id: "blue", label: "Blue", swatch: "#2f54eb" },
  { id: "red", label: "Red", swatch: "#e5484d" },
  { id: "green", label: "Green", swatch: "#12a150" },
] as const;

const SIZES = [
  { id: "s", label: "Fine", dot: 4 },
  { id: "m", label: "Medium", dot: 7 },
  { id: "l", label: "Bold", dot: 10 },
] as const;

/** Floating Apple-style tool palette at the bottom of the canvas. */
export function Toolbar() {
  const editor = useEditor();
  const tool = useValue("tool", () => editor.getCurrentToolId(), [editor]);
  const color = useValue("color", () => editor.getStyleForNextShape(DefaultColorStyle), [editor]);
  const size = useValue("size", () => editor.getStyleForNextShape(DefaultSizeStyle), [editor]);
  const canUndo = useValue("canUndo", () => editor.getCanUndo(), [editor]);
  const canRedo = useValue("canRedo", () => editor.getCanRedo(), [editor]);

  const inkTool = tool === "draw" || tool === "highlight";

  const setColor = (id: (typeof COLORS)[number]["id"]) => {
    editor.setStyleForNextShapes(DefaultColorStyle, id);
    editor.setStyleForSelectedShapes(DefaultColorStyle, id);
    if (!inkTool) editor.setCurrentTool("draw");
  };

  const setSize = (id: (typeof SIZES)[number]["id"]) => {
    editor.setStyleForNextShapes(DefaultSizeStyle, id);
    editor.setStyleForSelectedShapes(DefaultSizeStyle, id);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[300] flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div
        className="app-glass pointer-events-auto flex items-center gap-1 rounded-[22px] p-1.5"
        role="toolbar"
        aria-label="Drawing tools"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Group>
          {TOOLS.map((t) => (
            <ToolButton
              key={t.id}
              label={t.label}
              active={tool === t.id}
              layoutGroup="tool"
              onPress={() => editor.setCurrentTool(t.id)}
            >
              <t.icon className="h-[22px] w-[22px]" />
            </ToolButton>
          ))}
        </Group>

        <Divider />

        <Group>
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={color === c.id}
              onPointerDown={() => setColor(c.id)}
              className="app-press flex h-11 w-9 items-center justify-center rounded-xl"
            >
              <span
                className="block h-[22px] w-[22px] rounded-full transition-[box-shadow] duration-200"
                style={{
                  background: c.swatch,
                  boxShadow:
                    color === c.id
                      ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.swatch}`
                      : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                }}
              />
            </button>
          ))}
        </Group>

        <Divider className="hidden sm:block" />

        <Group className="hidden sm:flex">
          {SIZES.map((s) => (
            <ToolButton
              key={s.id}
              label={s.label}
              active={size === s.id}
              layoutGroup="size"
              onPress={() => setSize(s.id)}
              narrow
            >
              <span className="block rounded-full bg-current" style={{ width: s.dot, height: s.dot }} />
            </ToolButton>
          ))}
        </Group>

        <Divider />

        <Group>
          <ToolButton label="Undo" disabled={!canUndo} onPress={() => editor.undo()}>
            <UndoIcon className="h-[21px] w-[21px]" />
          </ToolButton>
          <ToolButton label="Redo" disabled={!canRedo} onPress={() => editor.redo()}>
            <RedoIcon className="h-[21px] w-[21px]" />
          </ToolButton>
        </Group>
      </div>
    </div>
  );
}

function Group({ children, className = "flex" }: { children: ReactNode; className?: string }) {
  return <div className={`${className} items-center gap-0.5`}>{children}</div>;
}

function Divider({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`mx-1 h-6 w-px bg-black/10 ${className}`} />;
}

/** Reacts on pointer-down (not release), with a sliding highlight for the active item. */
function ToolButton({
  children,
  label,
  active = false,
  disabled = false,
  narrow = false,
  layoutGroup,
  onPress,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  narrow?: boolean;
  layoutGroup?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={layoutGroup ? active : undefined}
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onPress();
      }}
      className={`app-press relative flex h-11 items-center justify-center rounded-xl transition-colors duration-200 disabled:opacity-30 ${
        narrow ? "w-9" : "w-11"
      } ${active ? "text-ink" : "text-[#3a3a3c]"}`}
    >
      {active && layoutGroup && (
        <motion.span
          layoutId={`active-${layoutGroup}`}
          className="absolute inset-0 rounded-xl bg-ink-wash"
          transition={spring}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}
