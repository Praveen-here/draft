/**
 * Tools Gemini can call (docs/AGENT_BRAIN.md §6). Turn these into Gemini function declarations
 * in /api/tutor; the brain runs them on the client (canvas, math) and sends results back.
 */
export const TOOLS = {
  readInk: "Read the student's handwriting (optionally in a region) as LaTeX lines.",
  getCircle: "Get the latest circled area: printed text, nearby lines, crop image.",
  checkStep: "Ask the math engine whether the next line is a valid step from the previous one.",
  checkAnswer: "Ask the math engine whether a final answer is correct.",
  highlight: "Highlight a term or region on the page in blue, green or red.",
  writeStep: "Write ONE line in tutor ink, animated like handwriting. Never the full solution.",
  mark: "Put a tick, gentle cross or circle on the canvas.",
  plot: "Draw a graph of a function next to the problem.",
  animateParam: "Slide a parameter of a plotted graph from one value to another while talking.",
  showVisual: "Show a ready-made visual: tangent line, area under a curve, number line, table of values.",
  ask: "Ask the student a question and wait for a spoken answer or their next written line.",
  updateModel: "Update the student model: stage, hint level, a misconception noticed.",
} as const;

export type ToolName = keyof typeof TOOLS;
