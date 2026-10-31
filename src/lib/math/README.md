# Part D: Math engine and visuals

**Branch:** `part-d/math-visuals` · **Owner:** _to assign_ · **Spec:** [AGENT_BRAIN.md §6, §8, §10](../../../docs/AGENT_BRAIN.md), [APPROACH_DRAFT.md §7–8](../../../docs/APPROACH_DRAFT.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

You keep the brain **honest** (the engine decides if a step is right, not Gemini) and give it **pictures** (graphs whose values change while ∂raft talks). You also own the **demo**.

## Your folders (only edit these)

| Folder | What's in it |
|---|---|
| `src/lib/math/` | Parsing LaTeX, checking steps and answers |
| `src/components/visuals/` | Graph, tangent, area, number line, table, and the `VisualsApi` ([README](../../components/visuals/README.md)) |

## Files

| File | Does | Status |
|---|---|---|
| `math/index.ts` | Public entry | ✅ |
| `math/parse.ts` | LaTeX → expression you can evaluate | ⬜ stub |
| `math/checkStep.ts` | `createMathApi()`: implements `MathApi` | ⬜ stub |
| `visuals/index.ts` | Public entry | ✅ |
| `visuals/visualsApi.ts` | `createVisualsApi(canvas)`: implements `VisualsApi`, mounts graphs via `canvas.mountVisual` | 🟡 skeleton |
| `visuals/Graph.tsx` | The graph component (plot + live parameter changes) | 🟡 placeholder |

## What you give the others

- `MathApi`: `checkStep(prev, next)`, `checkAnswer(problem, answer)` → `{ ok: true }` or `{ ok: false, reason }`
- `VisualsApi`: `run(plot | animateParam | showVisual)`

## What you use from others

- `CanvasApi.mountVisual` / `unmountVisual` (Part A) to place your visuals. Until ready: `fakeCanvas()`

## Tasks, in order

1. [ ] `parse.ts`: LaTeX → expression (`@cortex-js/compute-engine` or math.js); handle `\frac`, powers, `e^x`, trig
2. [ ] `checkStep`: compare both sides at 5–10 random points (watch for division by zero); `unsure` if parsing fails
3. [ ] `checkAnswer` for integrals: differentiate the answer (nerdamer) and compare to the integrand; ignore `+ C`
4. [ ] Pick the graph library (Q13: function-plot vs **Mafs**, leaning Mafs) and add it (tell the team first)
5. [ ] `Graph.tsx`: plot `fn` over `xRange` with `params`; smooth `animateParam` (spring/tween, reduced-motion aware)
6. [ ] `showVisual`: tangent line at a point, shaded area under a curve, number line, table of values
7. [ ] KaTeX for any typed math in visuals
8. [ ] **Demo**: pick 2–3 problems (∫x·eˣ dx; derivative of x² with a sliding tangent), write the demo script, record a backup video

## Test alone

Unit-check a list of `[prev, next, expected]` steps. Render `<Graph>` on its own page or call `createVisualsApi(fakeCanvas())`.
