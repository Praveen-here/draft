"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { Editor } from "tldraw";
import { sampleTurn } from "@/lib/fakes";
import type { CanvasHandle, InkRecognizer } from "@/lib/canvas";
import { addCircle, addLine, focusSample, loadWorksheet, sampleTarget } from "@/lib/canvas/tests/fixtures";
import { runCanvasChecks } from "@/lib/canvas/tests/browserChecks";
import { MotionProvider } from "@/components/landing/motion";
import type { DocSource } from "./types";

const Canvas = dynamic(() => import("./Canvas").then((module) => module.Canvas), { ssr: false });
const source: DocSource = { kind: "blank", paper: "grid" };

export function CanvasLab() {
  const [session, setSession] = useState<{ api: CanvasHandle; editor: Editor } | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Load a worksheet, or run the checks.");
  const reader = useRef<InkRecognizer>(async () => ["x + C"]);
  const readCount = useRef(0);
  const recogniseInk = useCallback<InkRecognizer>((image, signal) => {
    readCount.current++;
    return reader.current(image, signal);
  }, []);
  const onReady = useCallback((api: CanvasHandle, editor: Editor) => {
    setSession({ api, editor });
    return api.onEvent((event) => {
      const label = event.type === "circle" ? "circle · page " + event.context.pageNo + " · " + event.context.pdfText
        : event.type === "line" ? "line · " + event.latex : "idle · " + event.ms + " ms";
      setEvents((previous) => [label, ...previous].slice(0, 6));
    });
  }, []);

  const act = async (task: () => void | Promise<void>) => {
    setBusy(true);
    try { await task(); } catch (error) { setMessage(error instanceof Error ? error.message : "Check failed."); }
    finally { setBusy(false); }
  };
  const showTutor = () => {
    if (!session) return;
    const near = { bbox: sampleTarget(session.editor) };
    for (const beat of sampleTurn.beats) for (const action of beat.visuals) {
      if (action.type === "highlight") session.api.draw({ ...action, target: near });
      if (action.type === "writeStep") session.api.draw({ ...action, near });
      if (action.type === "mark") session.api.draw({ ...action, target: near });
    }
    session.api.draw({ type: "mark", target: near, kind: "tick" });
  };

  return (
    <MotionProvider>
      <Canvas source={source} onExit={() => { window.location.href = "/app"; }}
        onReady={onReady} recogniseInk={recogniseInk} tutor={false} />
      <aside className="canvas-panel fixed left-3 top-20 z-[500] max-h-[calc(100dvh-260px)] w-72 overflow-auto rounded-2xl p-4 text-sm"
        aria-label="Canvas test bench">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-semibold text-text">Part A · Canvas test bench</h1>
          <Link href="/app" className="text-ink underline">App</Link>
        </div>
        <p className="mt-2 leading-relaxed text-muted">Development only. Recognition returns the fixture “x + C”. Voice and graph controls are stubs; no API calls or microphone recording.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <LabButton disabled={!session || busy} onClick={() => void act(async () => {
            if (!session) return;
            await loadWorksheet(session.editor); focusSample(session.editor); setMessage("Two-page PDF loaded.");
          })}>Load worksheet</LabButton>
          <LabButton disabled={!session || busy} onClick={() => void act(() => { if (session) addCircle(session.editor); })}>Insert test circle</LabButton>
          <LabButton disabled={!session || busy} onClick={() => void act(() => { if (session) addLine(session.editor); })}>Write x + C</LabButton>
          <LabButton disabled={!session || busy} onClick={() => void act(showTutor)}>Tutor sample</LabButton>
          <LabButton disabled={!session || busy} onClick={() => void act(() => {
            if (!session) return;
            session.api.mountVisual("lab-graph", { bbox: sampleTarget(session.editor) },
              <div><p className="font-semibold text-ink">Graph placeholder</p><p className="mt-2">Part D supplies this component.</p>
                <label className="mt-3 block">Stub parameter <input type="range" min="1" max="3" step="0.1" defaultValue="1" /></label></div>);
            session.editor.zoomToFit();
          })}>Mount graph stub</LabButton>
          <LabButton disabled={!session || busy} onClick={() => session?.api.clearTutorInk()}>Clear tutor notes</LabButton>
        </div>
        <button type="button" disabled={!session || busy}
          className="app-press mt-3 w-full rounded-xl bg-ink px-3 py-2.5 font-semibold text-white disabled:opacity-50"
          onClick={() => void act(async () => {
            if (!session) return;
            setChecks([]); setMessage("Running checks…");
            try {
              await runCanvasChecks(session.editor, session.api, {
                setReader: (next) => { reader.current = next; },
                readCount: () => readCount.current,
                report: (result) => setChecks((previous) => [...previous, result]),
              });
              setMessage("All canvas checks passed.");
            } finally { reader.current = async () => ["x + C"]; }
          })}>{busy ? "Working…" : "Run checks (resets test page)"}</button>
        <p className="mt-3 text-muted" role="status">{message}</p>
        {checks.length > 0 && <ol className="mt-2 space-y-1 text-xs text-[#16603b]" aria-label="Canvas checks">
          {checks.map((check) => <li key={check}>{check}</li>)}
        </ol>}
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">Recent canvas events</summary>
          <ul className="mt-2 space-y-2 break-words text-xs text-muted">{events.map((event, i) => <li key={i}>{event}</li>)}</ul>
        </details>
      </aside>
    </MotionProvider>
  );
}

function LabButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick}
    className="app-press rounded-xl border border-line bg-white px-2 py-2 text-xs font-semibold text-text disabled:opacity-40">{children}</button>;
}
