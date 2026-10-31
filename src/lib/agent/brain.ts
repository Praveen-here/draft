import type {
  BBox,
  BrainApi,
  BrainStatus,
  CanvasApi,
  CanvasEvent,
  CircleContext,
  MathApi,
  Target,
  TutorTurn,
  VisualAction,
} from "@/lib/contracts";
import { learnerId, reportLine } from "./learner";
import type { RawTurn, RawVisual, TutorRequest, TutorResponse } from "./schema";
import { newStudentModel, type StudentModel } from "./studentModel";
import { decideTrigger } from "./triggers";
import { createWork } from "./work";

type Deps = { canvas: CanvasApi; math: MathApi };

/**
 * The teaching loop (docs/AGENT_BRAIN.md §3). Each question or answer from the student becomes one
 * Gemini turn; the student model carries hint level, angles tried and mistakes between turns.
 * The math engine (work.ts) watches the student's handwritten lines: a quiet ✓ for a right step, a gentle
 * flag for a wrong one, and "solved" only when it confirms the final answer. The server adds what it
 * remembers about this learner (learnerStore.ts) to every turn.
 */
export function createBrain({ canvas, math }: Deps): BrainApi {
  const turnListeners = new Set<(turn: TutorTurn) => void>();
  const statusListeners = new Set<(status: BrainStatus) => void>();
  let circle: CircleContext | null = null;
  let history: TutorRequest["history"] = [];
  let model: StudentModel = newStudentModel("none");
  let request = 0;
  /** Graphs on screen for the current circle (plotId → what's drawn), so Gemini reuses them. */
  let graphs = new Map<string, Graph>();
  /** The student's written lines for this problem, checked by the math engine. */
  const work = createWork(math);
  /** The problem is finished (the engine confirmed the answer, or the student explained it back). */
  let solved = false;
  let lastTurn: TutorTurn | null = null;
  /** A hint was already offered since the student last wrote or spoke. */
  let nudged = false;
  /** A Gemini turn is on its way. */
  let busy = false;
  /** Counts problems in this document: graph and card ids are tagged with it, so they never replace an earlier one's. */
  let problemNo = 0;

  const setStatus = (s: BrainStatus) => statusListeners.forEach((fn) => fn(s));
  /** A new problem starts with a clean slate; an answer still on its way for the old one is dropped. */
  const startProblem = (context: CircleContext | null) => {
    request++;
    busy = false;
    setStatus({ state: "idle" });
    history = [];
    graphs = new Map();
    model = newStudentModel(`circle-${Date.now()}`);
    problemNo++;
    // The problem is the printed text circled, or the first line of the student's own writing they circled.
    work.setProblem(context ? context.pdfText?.trim() || context.recentLines[0] || "" : "");
    solved = false;
    lastTurn = null;
    nudged = false;
  };

  const emit = (turn: TutorTurn) => {
    lastTurn = turn;
    if (turn.insight?.done) {
      solved = true;
      model = { ...model, stage: "done" };
    }
    turnListeners.forEach((fn) => fn(turn));
  };

  /** A short turn the brain says by itself, without asking Gemini (fast, no quota). */
  const sayLocal = (say: string, waitFor: TutorTurn["waitFor"], studentWas: "correct" | "asking", done = false, visuals: VisualAction[] = []) => {
    history = [...history, { role: "tutor" as const, text: say }].slice(-16);
    emit({
      beats: [{ say, visuals }],
      waitFor,
      question: waitFor === "answer" ? say : undefined,
      insight: { kind: done ? "check" : "next-step", doubt: "", studentWas, done },
    });
  };

  /**
   * One Gemini turn. transcript = what the student said; event = something they did that the brain reacts to
   * by itself (then `wrote` is what goes in the history); lead = visuals that open the first beat.
   */
  const ask = async (input: { transcript: string; event?: string; wrote?: string; answer?: TutorRequest["answer"]; lead?: VisualAction[] }) => {
    const id = ++request;
    busy = true;
    setStatus({ state: "thinking" });

    const body: TutorRequest = {
      image: circle?.cropImage || undefined,
      pdfText: circle?.pdfText || undefined,
      transcript: input.transcript,
      event: input.event,
      answer: input.answer,
      learnerId: learnerId(),
      problemId: model.problemId,
      problem: work.problem || undefined,
      work: work.describe(),
      graphs: [...graphs].map(([id, g]) =>
        `${id}: y = ${g.fn} (${Object.entries(g.params).map(([k, v]) => `${k} = ${v}`).join(", ")})` +
        (g.tangentParam ? `, tangent at x = ${g.tangentParam}` : "")),
      history,
      student: {
        hintLevel: model.hintLevel,
        anglesTried: model.triedAngles,
        misconceptions: model.misconceptions,
        checksPassed: model.checksPassed,
        checksFailed: model.checksFailed,
      },
    };

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as TutorResponse;
      if (id !== request) return; // the student asked something newer
      if ("error" in data) throw new Error(data.error);

      model = updateModel(model, data.turn);
      const turn = toTutorTurn(data.turn, circle, data.model, data.ms, graphs);
      // The server always sends at least one beat; the lead visuals appear as it starts.
      if (input.lead?.length && turn.beats[0]) turn.beats[0].visuals.unshift(...input.lead);
      rememberGraphs(graphs, turn);
      history = [
        ...history,
        { role: "student" as const, text: input.transcript || input.wrote || "(silent)" },
        { role: "tutor" as const, text: turn.beats.map((b) => b.say).join(" ") },
      ].slice(-16);

      busy = false;
      setStatus({ state: "idle" });
      emit(scoped(turn, `q${problemNo}_`));
    } catch (err) {
      if (id !== request) return;
      busy = false;
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  };

  /** A handwritten line near the circled problem: the engine checks it, and the brain reacts only if it must. */
  const onLine = async (event: Extract<CanvasEvent, { type: "line" }>) => {
    if (!circle || solved) return;
    const box = "bbox" in event.target ? event.target.bbox : null;
    if (box && !nearProblem(box, circle.bbox)) return;
    nudged = false;
    const problemId = model.problemId;
    const result = await work.addLine(event.latex, box);
    if (!result || problemId !== model.problemId) return; // already checked, or a new problem started meanwhile
    const { line, verdict } = result;
    if (verdict !== "unclear") reportLine(problemId, work.problem, verdict);

    if (verdict === "solved") {
      // The engine confirmed the final answer: that's done (D20), whatever the tutor was about to say.
      request++;
      busy = false;
      setStatus({ state: "idle" });
      canvas.draw({ type: "mark", target: event.target, kind: "tick" });
      sayLocal("Yes! That's the right answer, and you got there yourself.", "none", "correct", true);
      return;
    }
    const trigger = decideTrigger(event, line.check);
    if (trigger === "quiet-tick") canvas.draw({ type: "mark", target: event.target, kind: "tick" });
    // A wrong line: point at it and ask, never give the fix. Skipped while a turn is on its way (it'll see the line).
    if (trigger === "flag-wrong-line" && !busy) {
      const before = work.lines.length > 1 ? work.lines[work.lines.length - 2].latex : work.problem;
      await ask({
        transcript: "",
        wrote: `(wrote) ${line.latex}`,
        event: `The student wrote the line "${line.latex}" after "${before}". The math engine says it does not follow` +
          `${!line.check.ok && line.check.detail ? `: ${line.check.detail}` : "."} It is highlighted in red for them.`,
        lead: [{ type: "highlight", target: event.target, colour: "red" }],
      });
    }
  };

  /** The pen has been still for a while after the tutor asked for a line: offer a hint, once. */
  const onIdle = (event: Extract<CanvasEvent, { type: "idle" }>) => {
    if (!circle || solved || busy || nudged || lastTurn?.waitFor !== "line") return;
    if (decideTrigger(event) !== "offer-nudge") return;
    nudged = true;
    sayLocal("Stuck on the next line? Ask me for a hint whenever you like.", "answer", "asking");
  };

  return {
    handleCanvas(event) {
      if (event.type === "circle") {
        circle = event.context;
        startProblem(event.context);
      } else if (event.type === "line") {
        void onLine(event);
      } else if (event.type === "idle") {
        onIdle(event);
      }
    },

    async handleSpeech(said) {
      const transcript = said.transcript.trim();
      if (!transcript) return;
      nudged = false;
      // A typed or spoken answer that is math ("x e^x - e^x + C") is judged by the engine, not only by Gemini.
      const judged = circle && !solved ? await work.judgeAnswer(transcript) : null;
      const answer: TutorRequest["answer"] = judged
        ? {
            verdict: judged.check.ok ? "correct" : "wrong",
            final: judged.final,
            detail: judged.check.ok ? undefined : judged.check.detail,
          }
        : undefined;
      await ask({ transcript, answer });
    },

    onTurn(listener) {
      turnListeners.add(listener);
      return () => void turnListeners.delete(listener);
    },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => void statusListeners.delete(listener);
    },
    reset() {
      circle = null;
      // Forget the problem, not the page: the conversation, graphs and marks stay with the document.
      startProblem(null);
    },
  };
}

/**
 * Gemini reuses short ids ("p1", "a") on every problem. Everything stays on screen for the whole document, so
 * tag graph and card ids with the problem ("q2_p1") before they're shown; otherwise a new problem's graph would
 * replace an earlier one's. The brain's own memory of graphs keeps Gemini's ids, which is what Gemini sees.
 */
function scoped(turn: TutorTurn, prefix: string): TutorTurn {
  const id = (s: string) => (s.startsWith(prefix) ? s : `${prefix}${s}`).slice(0, 80);
  const scope = (v: VisualAction): VisualAction => {
    switch (v.type) {
      case "plot": return { ...v, id: id(v.id) };
      case "animateParam": return { ...v, plotId: id(v.plotId) };
      case "note": return { ...v, id: id(v.id) };
      case "showVisual": return v.args.id === undefined ? v : { ...v, args: { ...v.args, id: id(String(v.args.id)) } };
      default: return v;
    }
  };
  return { ...turn, beats: turn.beats.map((b) => ({ ...b, visuals: b.visuals.map(scope) })) };
}

/** Lines written below or beside the circled problem belong to it; writing elsewhere on the page doesn't. */
function nearProblem(line: BBox, c: BBox): boolean {
  return line.x + line.w > c.x - 300 && line.x < c.x + c.w + 600 && line.y + line.h > c.y - 100 && line.y < c.y + c.h + 1200;
}

/** Adapt between turns (docs/AGENT_BRAIN.md §4). */
function updateModel(m: StudentModel, raw: RawTurn): StudentModel {
  const angle = raw.angle?.trim().toLowerCase();
  const miss = raw.misconception?.trim();
  return {
    ...m,
    stage: raw.done ? "done" : raw.stage,
    hintLevel: raw.hintLevel as StudentModel["hintLevel"],
    triedAngles: angle && !m.triedAngles.includes(angle) ? [...m.triedAngles, angle] : m.triedAngles,
    misconceptions: miss && !m.misconceptions.includes(miss) ? [...m.misconceptions, miss] : m.misconceptions,
    checksPassed: m.checksPassed + (raw.studentWas === "correct" ? 1 : 0),
    checksFailed: m.checksFailed + (raw.studentWas === "wrong" ? 1 : 0),
  };
}

/** A graph on screen: its formula, current parameter values and view, and which param is a tangent point. */
export type Graph = {
  fn: string;
  params: Record<string, number>;
  xRange: [number, number];
  yRange?: [number, number];
  /** Gemini's name for the tangent point (e.g. "t"); Part D's tangent visual calls it "at". */
  tangentParam?: string;
};

/** Keep the graphs map in step with what this turn draws and slides. */
function rememberGraphs(graphs: Map<string, Graph>, turn: TutorTurn) {
  for (const v of turn.beats.flatMap((b) => b.visuals)) {
    if (v.type === "plot") graphs.set(v.id, { fn: v.fn, params: { ...v.params }, xRange: v.xRange, yRange: v.yRange });
    if (v.type === "showVisual" && v.kind === "tangent") {
      const g = graphs.get(String(v.args.id));
      if (g) {
        g.tangentParam = String(v.args.param);
        g.params[g.tangentParam] = Number(v.args.at);
      }
    }
    if (v.type === "animateParam") {
      const g = graphs.get(v.plotId);
      if (g) g.params[v.param === "at" && g.tangentParam ? g.tangentParam : v.param] = v.to;
    }
  }
}

/**
 * Gemini's turn → contract turn: boxes on the circled picture become canvas coordinates, and graph actions
 * take the shape Part D's visuals expect (a tangent or area is a full visual that replaces its plot in place).
 * @param known graphs already on screen from earlier turns, so a tangent can be added to one of them.
 */
export function toTutorTurn(
  raw: RawTurn,
  circle: CircleContext | null,
  model?: string,
  ms?: number,
  known: Map<string, Graph> = new Map(),
): TutorTurn {
  // Part D's visuals need a real box to place things near; with nothing circled, use a 1×1 box.
  const near: Target = { bbox: circle && circle.bbox.w > 0 && circle.bbox.h > 0 ? circle.bbox : { x: 0, y: 0, w: 1, h: 1 } };
  const all = raw.beats.flatMap((b) => b.visuals);
  const plots = new Map([...known].map(([id, g]) => [id, { ...g, params: { ...g.params } }]));

  const convert = (v: RawVisual): VisualAction | null => {
    switch (v.type) {
      case "highlight": {
        const bbox = toPage(v.box, circle);
        return bbox ? { type: "highlight", target: { bbox }, colour: v.colour ?? "blue" } : null;
      }
      case "mark": {
        const bbox = toPage(v.box, circle);
        return bbox ? { type: "mark", target: { bbox }, kind: v.mark ?? "circle" } : null;
      }
      case "writeStep":
        return v.text ? { type: "writeStep", text: v.text, near } : null;
      case "note": {
        if (!v.noteId || !v.title) return null;
        const bbox = toPage(v.box, circle);
        const kind = v.kind && ["variable", "number", "rule", "mistake"].includes(v.kind) ? v.kind : "variable";
        return { type: "note", id: v.noteId, kind, title: v.title, text: v.text ?? "", target: bbox ? { bbox } : null };
      }
      case "plot": {
        if (!v.fn || !v.plotId) return null;
        const params: Record<string, number> = {};
        for (const p of v.params ?? []) if (p?.name) params[p.name] = p.value;
        // If a later animation slides a param the plot forgot to set, start it where the animation starts.
        for (const a of all) if (a.type === "animate" && a.plotId === v.plotId && a.param && params[a.param] === undefined) params[a.param] = a.from ?? 1;
        const xMin = finite(v.xMin, -5);
        const xMax = finite(v.xMax, 5);
        const yRange: [number, number] | undefined =
          Number.isFinite(v.yMin) && Number.isFinite(v.yMax) && (v.yMax as number) > (v.yMin as number) ? [v.yMin as number, v.yMax as number] : undefined;
        const xRange: [number, number] = xMax > xMin ? [xMin, xMax] : [-5, 5];
        plots.set(v.plotId, { fn: v.fn, params, xRange, yRange });
        return { type: "plot", id: v.plotId, fn: v.fn, xRange, yRange, params, near };
      }
      case "animate": {
        if (!v.plotId || !v.param) return null;
        const g = plots.get(v.plotId);
        return {
          type: "animateParam",
          plotId: v.plotId,
          param: g?.tangentParam === v.param ? "at" : v.param,
          from: finite(v.from, 0),
          to: finite(v.to, 1),
          ms: Math.min(6000, Math.max(600, finite(v.seconds, 2.5) * 1000)),
        };
      }
      case "tangent": {
        const g = v.plotId ? plots.get(v.plotId) : undefined;
        if (!g || !v.plotId) return null;
        const param = v.param ?? "t";
        const { [param]: point, ...params } = g.params;
        g.tangentParam = param;
        const at = Number.isFinite(point) ? point : (g.xRange[0] + g.xRange[1]) / 2;
        return { type: "showVisual", kind: "tangent", args: { id: v.plotId, fn: g.fn, at, param, xRange: g.xRange, yRange: g.yRange, params }, near };
      }
      case "area": {
        const g = v.plotId ? plots.get(v.plotId) : undefined;
        if (!g || !v.plotId) return null;
        const { from: _f, to: _t, ...params } = g.params;
        return {
          type: "showVisual",
          kind: "area",
          args: { id: v.plotId, fn: g.fn, from: finite(v.from, 0), to: finite(v.to, 1), xRange: g.xRange, yRange: g.yRange, params },
          near,
        };
      }
      default:
        return null;
    }
  };

  return {
    beats: raw.beats.map((b) => ({
      say: b.say,
      visuals: b.visuals.map(convert).filter((v): v is VisualAction => v !== null),
    })),
    waitFor: raw.done ? "none" : raw.waitFor,
    question: raw.question || undefined,
    insight: { kind: raw.kind, doubt: raw.doubt, studentWas: raw.studentWas, done: raw.done, model, ms },
  };
}

/** [ymin, xmin, ymax, xmax] in 0–1000 on the circled picture → a box on the canvas. */
function toPage(box: number[] | undefined, circle: CircleContext | null): BBox | null {
  if (!circle || !box || box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map((n) => Math.min(1000, Math.max(0, n)) / 1000);
  if (xmax <= xmin || ymax <= ymin) return null;
  const c = circle.bbox;
  return { x: c.x + xmin * c.w, y: c.y + ymin * c.h, w: (xmax - xmin) * c.w, h: (ymax - ymin) * c.h };
}

const finite = (n: number | undefined, fallback: number) => (Number.isFinite(n) ? (n as number) : fallback);
