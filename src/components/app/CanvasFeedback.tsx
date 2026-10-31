"use client";

import { useEffect } from "react";
import { useEditor, useValue } from "tldraw";
import type { CircleContext } from "@/lib/contracts";
import type { CanvasHandle } from "@/lib/canvas";
import { MicButton } from "@/components/voice";

export type CanvasVoiceControl = { on: boolean; onToggle: (on: boolean) => void };

export function CanvasFeedback({ api, context, voice, reading, notice, onNotice }: {
  api: CanvasHandle; context: CircleContext | null; voice?: CanvasVoiceControl;
  reading: boolean; notice: string | null; onNotice: (message: string | null) => void;
}) {
  const editor = useEditor();
  const hasTutorInk = useValue("tutor notes", () => editor.getCurrentPageShapes().some((s) => s.meta.author === "tutor"), [editor]);
  useEffect(() => {
    return api.onEvent((event) => { if (event.type === "circle" || event.type === "line") onNotice(null); });
  }, [api, onNotice]);

  const toggleMic = (on: boolean) => {
    if (voice) voice.onToggle(on);
    else onNotice("Voice isn't connected yet. You can keep working on the page.");
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[90px] z-[300] flex flex-wrap items-end justify-between gap-2"
      onPointerDown={(event) => event.stopPropagation()}>
      <div className="pointer-events-auto max-w-sm rounded-2xl canvas-panel px-4 py-3 text-sm">
        {context ? (
          <details>
            <summary className="cursor-pointer font-semibold text-ink">
              Selected area{context.pageNo ? " · Page " + context.pageNo : ""}
            </summary>
            <img src={context.cropImage} alt="The area you circled" className="mt-2 max-h-32 max-w-full rounded-lg border border-line bg-white" />
            {context.pdfText && <p className="mt-2 max-h-20 overflow-auto text-text">{context.pdfText}</p>}
          </details>
        ) : <p className="text-muted">Circle a step or select an equation in Layers.</p>}
        {reading && <p className="mt-1 text-ink" role="status">Reading your writing…</p>}
        {notice && (
          <div className="mt-2 flex items-start gap-2">
            <p role="status" className="max-w-xs text-[#7b4320]">{notice}</p>
            <button type="button" onClick={() => onNotice(null)} className="app-press rounded px-2 py-1" aria-label="Dismiss message">×</button>
          </div>
        )}
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        {hasTutorInk && <button type="button" onClick={() => api.clearTutorInk()}
          className="canvas-panel app-press rounded-full px-4 py-3 text-sm font-semibold text-text">Clear tutor notes</button>}
        <div onKeyDown={(event) => {
          // The supplied Part C placeholder handles pointer input only.
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleMic(!voice?.on); }
        }}>
          <MicButton on={voice?.on ?? false} onToggle={toggleMic} />
        </div>
      </div>
    </div>
  );
}
