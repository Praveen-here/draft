import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CanvasApi, StepCheck, VisualAction } from "@/lib/contracts";
import { fakeCanvas } from "@/lib/fakes";
import { createMathApi, parseLatex } from "@/lib/math";
import { createVisualsApi, FunctionExplorer, MathText, type VisualsController } from "../index";
import styles from "./preview.module.css";

type GraphAction = Extract<VisualAction, { type: "plot" | "animateParam" | "showVisual" }>;
type Lesson = "tangent" | "curve" | "area" | "numberLine" | "table" | "explorer";
const target = { bbox: { x: 0, y: 0, w: 400, h: 100 } };
const lessons: Record<Lesson, { tab: string; number: string; title: string; body: string; question: string }> = {
  tangent: { tab: "Slope & tangent", number: "01", title: "Feel what a derivative means.", body: "Move along the curve. The green line follows the slope at the point you choose.", question: "Where does the curve stop falling and start rising?" },
  curve: { tab: "Changing a curve", number: "02", title: "One small value. A different curve.", body: "Change a and watch the parabola respond. The axes stay fixed, so you can see the difference.", question: "What happens to the curve when a becomes negative?" },
  area: { tab: "Area", number: "03", title: "Give the integral a shape.", body: "Move the boundaries to see the region an integral describes. Build the idea before calculating.", question: "Why does moving the right boundary change the shaded region?" },
  numberLine: { tab: "Number line", number: "04", title: "Start with a sense of place.", body: "Use zero as your anchor. A value further right is greater, even when both values are negative.", question: "Which marked value is furthest from zero?" },
  table: { tab: "Value table", number: "05", title: "Let a pattern emerge.", body: "Look at the inputs and their outputs side by side. Small examples can make a rule easier to see.", question: "What do opposite inputs have in common here?" },
  explorer: { tab: "Function lab", number: "06", title: "Make the graph yours.", body: "Write a function and explore it directly.", question: "What changes when you move one value?" },
};
function lessonFromHash(): Lesson {
  if (typeof window === "undefined") return "tangent";
  const key = window.location.hash.slice(1);
  if (key === "function-lab") return "explorer";
  return Object.hasOwn(lessons, key) ? key as Lesson : "tangent";
}
function actionFor(lesson: Exclude<Lesson, "explorer">): GraphAction {
  switch (lesson) {
    case "tangent": return { type: "showVisual", kind: "tangent", args: { id: "lesson", fn: "x^2", at: 1, xRange: [-3, 3], yRange: [-2, 9] }, near: target };
    case "curve": return { type: "plot", id: "lesson", fn: "a*x^2", xRange: [-3, 3], params: { a: 1 }, near: target };
    case "area": return { type: "showVisual", kind: "area", args: { id: "lesson", fn: "x^2", from: 0, to: 2, xRange: [-0.8, 3.2], yRange: [-1, 8] }, near: target };
    case "numberLine": return { type: "showVisual", kind: "numberLine", args: { id: "lesson", range: [-5, 5], values: [-2, 0, 2.5] }, near: target };
    case "table": return { type: "showVisual", kind: "table", args: { id: "lesson", fn: "x^2", xs: [-2, -1, 0, 1, 2] }, near: target };
  }
}
declare global {
  interface Window {
    partDPreview?: { run(action: GraphAction): void; stop(): void; clear(): void };
  }
}

function CheckMark() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function Preview() {
  const [lesson, setLesson] = useState<Lesson>(lessonFromHash);
  const [nodes, setNodes] = useState<Map<string, ReactNode>>(new Map());
  const [ready, setReady] = useState(false);
  const [narration, setNarration] = useState("");
  const [playing, setPlaying] = useState(false);
  const [visualError, setVisualError] = useState("");
  const api = useRef<VisualsController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const stop = () => { clearTimers(); api.current?.stop(); setPlaying(false); };

  useEffect(() => {
    const canvas: CanvasApi = {
      ...fakeCanvas(),
      mountVisual(id, _near, node) { setNodes((current) => new Map(current).set(id, node)); },
      unmountVisual(id) { setNodes((current) => { const next = new Map(current); next.delete(id); return next; }); },
    };
    const controller = createVisualsApi(canvas, { onError: setVisualError,
      onInteraction: () => {
        clearTimers(); api.current?.stop(); setPlaying(false);
        setNarration("You're in control. Move a value and notice what changes.");
      },
    });
    api.current = controller;
    if (lesson !== "explorer") controller.run(actionFor(lesson));
    setReady(true);
    window.partDPreview = { run: (action) => controller.run(action), stop: () => controller.stop(),
      clear: () => { controller.dispose(); setNodes(new Map()); } };
    return () => {
      clearTimers(); controller.dispose(); api.current = null; delete window.partDPreview;
    };
  }, []);

  const choose = (value: Lesson) => {
    stop(); setNarration(""); setVisualError(""); setLesson(value);
    if (value !== "explorer") api.current?.run(actionFor(value));
    window.history.replaceState(null, "", value === "explorer" ? "#function-lab" : "#" + value);
  };
  useEffect(() => {
    const navigate = () => choose(lessonFromHash());
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    const active = document.getElementById("tab-" + lesson);
    const tabs = active?.parentElement;
    if (!active || !tabs) return;
    const reveal = () => {
      const item = active.getBoundingClientRect(), strip = tabs.getBoundingClientRect();
      if (item.left < strip.left + 10) tabs.scrollLeft += item.left - strip.left - 10;
      else if (item.right > strip.right - 10) tabs.scrollLeft += item.right - strip.right + 10;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [lesson]);
  const animate = (param: string, from: number, to: number, ms: number) =>
    api.current?.run({ type: "animateParam", plotId: "lesson", param, from, to, ms });
  const later = (ms: number, callback: () => void) => { timers.current.push(setTimeout(callback, ms)); };
  const play = () => {
    if (playing) { stop(); return; }
    stop(); setPlaying(true); setVisualError("");
    if (lesson === "tangent") {
      api.current?.run({ type: "showVisual", kind: "tangent", args: { id: "lesson", fn: "x^2", at: -2, xRange: [-3, 3], yRange: [-2, 9] }, near: target });
      setNarration("On this side, the curve falls as you move right.");
      later(500, () => animate("at", -2, 0, 2400));
      later(2900, () => setNarration("At the bottom, the tangent is flat. Its slope is zero."));
      later(3900, () => { setNarration("Now move right. The curve rises, and the slope turns positive."); animate("at", 0, 2, 2600); });
      later(6600, () => { setNarration("Your turn: what do you notice about x and the slope?"); setPlaying(false); });
    } else if (lesson === "curve") {
      api.current?.run(actionFor("curve"));
      setNarration("Watch a grow. The curve becomes steeper without the axes moving.");
      animate("a", 1, 3, 2600);
      later(3300, () => { setNarration("A smaller positive a opens the curve out. What might a negative a do?"); animate("a", 3, 0.5, 2600); });
      later(6100, () => setPlaying(false));
    } else if (lesson === "area") {
      api.current?.run(actionFor("area"));
      setNarration("Move the right boundary. More of the curve now sits above the shaded region.");
      animate("to", 2, 2.7, 3000);
      later(3300, () => { setNarration("The picture describes the accumulation. How would you estimate it?"); setPlaying(false); });
    } else {
      setNarration(lessons[lesson].question);
      later(2500, () => setPlaying(false));
    }
  };

  const current = lessons[lesson];
  return <div className={styles.page}>
    <header className={styles.topbar}>
      <a className={styles.logo} href="http://127.0.0.1:3000" aria-label="Back to Draft">∂raft<span className={styles.divider} /> <span className={styles.studio}>Math studio</span></a>
      <div className={styles.previewBadge}><span />Local preview</div>
    </header>
    <main className={styles.main}>
      <section className={styles.intro}>
        <div><p className={styles.eyebrow}>A LITTLE CLARITY, ONE STEP AT A TIME</p><h1>See the idea.<br /><span>Take the next step.</span></h1></div>
        <p className={styles.introText}>Make sense of the maths with a picture.<br />Then try a step of your own.</p>
      </section>
      <section className={styles.explore} aria-label="Explore a mathematical idea">
        <div className={styles.tabs} role="tablist" aria-label="Math concepts">
          {(Object.keys(lessons) as Lesson[]).map((key) => <button key={key} type="button" role="tab"
            id={"tab-" + key} tabIndex={lesson === key ? 0 : -1} aria-selected={lesson === key} aria-controls="visual-panel"
            className={lesson === key ? styles.activeTab : ""} onClick={() => choose(key)} disabled={!ready}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const keys = Object.keys(lessons) as Lesson[];
              const index = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1
                : (keys.indexOf(key) + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
              choose(keys[index]); document.getElementById("tab-" + keys[index])?.focus();
            }}>
            {lessons[key].tab}
          </button>)}
        </div>
        {lesson === "explorer" ? <div id="visual-panel" role="tabpanel" aria-labelledby="tab-explorer"><FunctionExplorer /></div> :
        <div className={styles.lesson} id="visual-panel" role="tabpanel" aria-labelledby={"tab-" + lesson}>
          <div className={styles.lessonCopy}>
            <div className={styles.lessonNumber}><span>{current.number}</span> / EXPLORE THE IDEA</div>
            <h2>{current.title}</h2>
            <p>{current.body}</p>
            <div className={styles.question}><span className={styles.questionIcon}>?</span><div><span className={styles.questionLabel}>A question to sit with</span><p>{current.question}</p></div></div>
            <div className={styles.lessonActions}>
              <button type="button" className={styles.primaryButton} onClick={play} disabled={!ready}>
                <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>{playing ? "Pause explanation" : "Play explanation"}
              </button>
              <button type="button" className={styles.resetButton} onClick={() => choose(lesson)}>Reset</button>
            </div>
            <p className={styles.captionNote}>Follow the captions as the picture changes.</p>
            <div className={styles.narration} aria-live="polite" data-testid="narration">
              <span className={styles.tutorAvatar}>∂</span>
              <p>{narration || "Move a value or play the explanation. I’ll help you see what changes."}</p>
            </div>
          </div>
          <div className={styles.canvas} data-testid="visual-canvas">
            {[...nodes].map(([id, node]) => <div key={id} data-visual-id={id}>{node}</div>)}
            {visualError && <p className={styles.visualError} role="status">{visualError}</p>}
          </div>
        </div>}
      </section>
      <MathChecker />
      <footer className={styles.footer}><span><CheckMark />Math and visuals run locally. No API keys needed.</span>
        <span>Part D · Canvas and narration use demo adapters.</span></footer>
    </main>
  </div>;
}

function MathChecker() {
  const [mode, setMode] = useState<"step" | "answer">("step");
  const [previous, setPrevious] = useState("\\int x e^x\\,dx");
  const [next, setNext] = useState("x e^{x}-\\int e^x\\,dx");
  const [result, setResult] = useState<StepCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const math = useRef(createMathApi());
  const invalidate = () => { version.current++; setResult(null); };
  const sample = (kind: "correct" | "sign" | "context") => {
    invalidate(); setMode("step");
    if (kind === "context") { setPrevious("(x-1)/(x-1)"); setNext("1"); }
    else { setPrevious("\\int x e^x\\,dx"); setNext(kind === "correct" ? "x e^{x}-\\int e^x\\,dx" : "x e^{x}+\\int e^x\\,dx"); }
  };
  const check = async (event: React.FormEvent) => {
    event.preventDefault();
    const attempt = ++version.current;
    setBusy(true);
    const answer = mode === "step" ? await math.current.checkStep(previous, next) : await math.current.checkAnswer(previous, next);
    if (attempt === version.current) setResult(answer);
    setBusy(false);
  };
  const preview = (text: string) => parseLatex(text)?.latex || text;
  return <section className={styles.checker} aria-labelledby="checker-title">
    <div className={styles.checkerHeader}><div><p className={styles.eyebrow}>YOUR TURN</p><h2 id="checker-title">Does the next step hold up?</h2>
      <p>A small check, so you can keep going with confidence.</p></div>
      <div className={styles.modeSwitch} aria-label="Check type">
        <button type="button" aria-pressed={mode === "step"} onClick={() => { invalidate(); setMode("step"); }}>Check a step</button>
        <button type="button" aria-pressed={mode === "answer"} onClick={() => { invalidate(); setMode("answer"); }}>Check an answer</button>
      </div>
    </div>
    <form onSubmit={check}>
      <div className={styles.fields}>
        <div><label htmlFor="previous-line">{mode === "step" ? "Previous line" : "Problem"}</label>
          <textarea id="previous-line" value={previous} spellCheck={false} rows={2}
            onChange={(event) => { invalidate(); setPrevious(event.target.value); }} />
          <div className={styles.mathPreview}><MathText latex={preview(previous)} /></div>
        </div>
        <div><label htmlFor="next-line">{mode === "step" ? "Your next line" : "Your answer"}</label>
          <textarea id="next-line" value={next} spellCheck={false} rows={2}
            onChange={(event) => { invalidate(); setNext(event.target.value); }} />
          <div className={styles.mathPreview}><MathText latex={preview(next)} /></div>
        </div>
      </div>
      <div className={styles.checkerActions}>
        <div className={styles.samples}><span>Try:</span><button type="button" onClick={() => sample("correct")}>Correct step</button>
          <button type="button" onClick={() => sample("sign")}>Sign mistake</button><button type="button" onClick={() => sample("context")}>Needs context</button></div>
        <button type="submit" className={styles.primaryButton} disabled={busy || !previous.trim() || !next.trim()}>
          <CheckMark />{busy ? "Checking…" : "Check my work"}
        </button>
      </div>
    </form>
    {result && <div className={result.ok ? styles.success : result.reason === "not-equivalent" ? styles.mistake : styles.uncertain}
      data-testid="check-result" data-result={result.ok ? "ok" : result.reason} role="status" aria-live="polite">
      <span className={styles.resultIcon}>{result.ok ? <CheckMark /> : result.reason === "not-equivalent" ? "↺" : "?"}</span>
      <div><strong>{result.ok ? "That checks out. Your turn for the next line." : result.reason === "not-equivalent" ? "Take another look at this step." : "Let's check the notation and context."}</strong>
        <p>{result.ok ? "The math engine verified this step." : result.detail}</p></div>
    </div>}
  </section>;
}
