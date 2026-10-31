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
| `math/parse.ts` | LaTeX / unicode / plain text → expression you can evaluate (∫ and d/dx included) | ✅ |
| `math/compare.ts` | Random-point comparison (exact or up to a constant), equation roots | ✅ |
| `math/checkStep.ts` | `createMathApi()`: implements `MathApi` (`checkStep`, `checkAnswer`) | ✅ |
| `math/check.test.ts` | 71 cases incl. the practice sheet's Q5–Q11; `npx jiti src/lib/math/check.test.ts` | ✅ |
| `visuals/index.ts` | Public entry | ✅ |
| `visuals/visualsApi.ts` | `createVisualsApi(canvas)`: implements `VisualsApi`, mounts graphs via `canvas.mountVisual` | 🟡 skeleton |
| `visuals/Graph.tsx` | The graph component (plot + live parameter changes) | 🟡 placeholder |

## What you give the others

- `MathApi`: `checkStep(prev, next)`, `checkAnswer(problem, answer)` → `{ ok: true }` or `{ ok: false, reason }`
- `VisualsApi`: `run(plot | animateParam | showVisual)`

## What you use from others

- `CanvasApi.mountVisual` / `unmountVisual` (Part A) to place your visuals. Until ready: `fakeCanvas()`

## Tasks, in order

1. [x] `parse.ts`: LaTeX → mathjs (own converter, no extra library); `\frac`, powers, `e^x`, trig, `\sqrt`, `|x|`, `∫`, `d/dx`, unicode (`x²`, `eˣ`, `−`)
2. [x] `checkStep`: compare at random points (skips points where a side is undefined); `unsure` / `unparseable` instead of guessing
3. [x] `checkAnswer`: integrals, derivatives, "solve" (each root checked, missing roots found), simplify/expand
4. [ ] Pick the graph library (Q13: function-plot vs **Mafs**, leaning Mafs) and add it (tell the team first)
5. [ ] `Graph.tsx`: plot `fn` over `xRange` with `params`; smooth `animateParam` (spring/tween, reduced-motion aware)
6. [ ] `showVisual`: tangent line at a point, shaded area under a curve, number line, table of values
7. [ ] KaTeX for any typed math in visuals
8. [ ] **Demo**: pick 2–3 problems (∫x·eˣ dx; derivative of x² with a sliding tangent), write the demo script, record a backup video

## How the engine decides (short)

- **Values:** evaluate both lines at random x (two rounds, other letters fixed per round). All equal → ✓.
- **Integrals:** every `∫ f dx` is computed as ∫ from 1 to x (Simpson's rule). Both lines use the same start, so lines with ∫ are compared **up to a constant**. A final answer with no ∫ left and no new letter (C, c, K…) → "missing + C".
- **Equations** (`2x + 3 = 14`): lhs − rhs must be a constant multiple of the line before; otherwise the real solutions in [−10, 10] are compared ("before x = 4; after x = 5.5").
- **Side notes** (`u = x`, `du = dx`) and **words** → `unsure` / `unparseable`, so the tutor stays quiet. `dy/dx = …` after `y = …` is checked against the derivative.
- `detail` says where it went wrong (for the brain, not to be read out as the answer). The API never throws: an engine bug returns `unsure`.

## Test alone

`npx jiti src/lib/math/check.test.ts` (prints every case with its verdict and time; exits 1 on a failure). Render `<Graph>` on its own page or call `createVisualsApi(fakeCanvas())`.
