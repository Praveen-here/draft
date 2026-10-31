/**
 * The JSON shape Gemini must reply with (structured output), and its TypeScript type.
 * Raw turns use coordinates on the circled picture; brain.ts converts them to canvas coordinates.
 */

export type RawVisual = {
  type: "highlight" | "mark" | "writeStep" | "plot" | "animate" | "tangent" | "area";
  box?: number[];
  colour?: "blue" | "green" | "red";
  mark?: "tick" | "cross" | "circle";
  text?: string;
  plotId?: string;
  fn?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  params?: { name: string; value: number }[];
  param?: string;
  from?: number;
  to?: number;
  seconds?: number;
};

export type RawTurn = {
  kind: "next-step" | "why" | "meaning" | "check" | "show" | "answer" | "other";
  doubt: string;
  studentWas: "asking" | "correct" | "partly" | "wrong" | "unsure" | "claims-understood";
  stage: "understand" | "diagnose" | "explain" | "check" | "practice" | "verify" | "done";
  hintLevel: number;
  angle: string;
  misconception: string;
  done: boolean;
  beats: { say: string; visuals: RawVisual[] }[];
  waitFor: "answer" | "line" | "none";
  question: string;
};

const str = (e?: string[]) => (e ? { type: "STRING", enum: e } : { type: "STRING" });
const num = { type: "NUMBER" };

const box = { type: "ARRAY", items: { type: "INTEGER" }, description: "[ymin, xmin, ymax, xmax] on the circled picture, 0-1000" };
const obj = (type: string, props: Record<string, unknown>, required: string[]) => ({
  type: "OBJECT",
  properties: { type: str([type]), ...props },
  required: ["type", ...required],
});

/** One schema per visual type, so every visual comes with the fields it needs. */
const visual = {
  anyOf: [
    obj("highlight", { box, colour: str(["blue", "green", "red"]) }, ["box", "colour"]),
    obj("mark", { box, mark: str(["tick", "cross", "circle"]) }, ["box", "mark"]),
    obj("writeStep", { text: str() }, ["text"]),
    obj(
      "plot",
      {
        plotId: str(),
        fn: { type: "STRING", description: "math.js expression in x and the param names, e.g. a*x^2" },
        xMin: num,
        xMax: num,
        yMin: num,
        yMax: num,
        params: {
          type: "ARRAY",
          items: { type: "OBJECT", properties: { name: str(), value: num }, required: ["name", "value"] },
        },
      },
      ["plotId", "fn", "xMin", "xMax", "params"],
    ),
    obj("animate", { plotId: str(), param: str(), from: num, to: num, seconds: num }, ["plotId", "param", "from", "to", "seconds"]),
    obj("tangent", { plotId: str(), param: str() }, ["plotId", "param"]),
    obj("area", { plotId: str(), from: num, to: num }, ["plotId", "from", "to"]),
  ],
};

/** Gemini responseSchema (OpenAPI subset). */
export const TURN_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: str(["next-step", "why", "meaning", "check", "show", "answer", "other"]),
    doubt: str(),
    studentWas: str(["asking", "correct", "partly", "wrong", "unsure", "claims-understood"]),
    stage: str(["understand", "diagnose", "explain", "check", "practice", "verify", "done"]),
    hintLevel: { type: "INTEGER" },
    angle: str(),
    misconception: str(),
    done: { type: "BOOLEAN" },
    beats: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { say: str(), visuals: { type: "ARRAY", items: visual } },
        required: ["say", "visuals"],
      },
    },
    waitFor: str(["answer", "line", "none"]),
    question: str(),
  },
  required: ["kind", "doubt", "studentWas", "stage", "hintLevel", "angle", "misconception", "done", "beats", "waitFor", "question"],
  propertyOrdering: ["kind", "doubt", "studentWas", "stage", "hintLevel", "angle", "misconception", "done", "beats", "waitFor", "question"],
};

/** What the browser sends to /api/tutor. */
export type TutorRequest = {
  /** PNG data URL of the circled area (absent if nothing circled yet). */
  image?: string;
  pdfText?: string;
  transcript: string;
  /** Graphs already on screen for this circle, e.g. "p1: y = a*x^2 (a = 3)". */
  graphs: string[];
  history: { role: "student" | "tutor"; text: string }[];
  student: {
    hintLevel: number;
    anglesTried: string[];
    misconceptions: string[];
    checksPassed: number;
    checksFailed: number;
  };
};

export type TutorResponse = { turn: RawTurn; model: string; ms: number } | { error: string };
