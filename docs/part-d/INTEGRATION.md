# Part D integration handoff

Branch: `part-d/math-visuals`. The math and visual implementations are ready for the shared interfaces in `src/lib/contracts.ts`.

## What is real, and what is temporary

- Real: LaTeX parsing, step and integral verification, graph rendering, tangent/area/number-line/table components, animation, and typed math.
- Temporary: `src/components/visuals/preview/Preview.tsx` wraps `fakeCanvas()` with a React-node mounting adapter. Its lesson captions stand in for Part C's narration. These adapters are used only by the separate preview.
- The existing application at port 3000 remains the team app. The isolated preview is at port 4173; no team-owned route is needed to test Part D.

## Part B: math tool wiring

```ts
import { createMathApi } from "@/lib/math";
const math = createMathApi();
// Supply this to createBrain({ canvas, math }).
```

Pass recognized expressions as LaTeX strings, including both sides for equation steps. A leading `=` on a continuation line is accepted. The demo's integration-by-parts intermediate line is supported.

Only `{ ok: true }` should produce a tick. `not-equivalent` can trigger a hint. `unparseable` and `unsure` mean ask for transcription/context; they must not increment a student's wrong-answer count.

The current verifier supports real expressions, linear/quadratic solution sets, indefinite integrals, and supported symbolic derivatives. Sampling is not a universal proof. See the [math guide](../../src/lib/math/README.md) for limits.

## Parts A and C / lead: visual wiring

Create this in client code when the canvas API is available:

```ts
import { createVisualsApi } from "@/components/visuals";
const visuals = createVisualsApi(canvas, {
  onError: (message) => console.warn("Visual request:", message),
});
// Supply visuals to createPlayer({ canvas, visuals }).
```

Part A's `mountVisual` should render the supplied React node in a stable custom shape near the requested `Target`. Reusing an id replaces that visual. Do not render a fresh React root on each parameter frame: the supplied component subscribes to its store itself.

Part C fires `visuals.run(action)` at the start of the spoken beat. The controller extends the shared interface with `stop()` and `dispose()`:

- Call `visuals.stop()` alongside audio stop on pause/barge-in. It freezes the current values.
- Call `visuals.dispose()` on document close/reset. It cancels timers and unmounts only its own visuals. Create a fresh controller for the next document.
- Keep the concrete `VisualsController` handle in the composition owner if a player's parameter is typed only as the base `VisualsApi`.

The shared contract is unchanged. Session wiring, the canvas route, the player implementation, and the shared fake APIs remain with their owners.

## Direct exploration

Every curve plot now has a draggable probe with live x/f(x) readings. Tangent points and area boundaries can be grabbed directly, using a mouse, pen, or touch. Handles are labelled sliders for assistive technology and support arrow keys plus Home/End. At undefined or off-screen function values, a probe stays on the horizontal reference line and the UI explains why.

The controller accepts an optional `onInteraction` callback. It stops the active visual's animations on pointer-down or keyboard input, then calls this callback so the composition owner can pause Part C's player and cancel queued beats. The separate preview demonstrates this with its caption timers.

```ts
const visuals = createVisualsApi(canvas, {
  onInteraction: () => player.stop(), // stop speaking and drop queued beats
});
```

`FunctionExplorer` is an optional client component exported from `@/components/visuals`. It provides editable functions, automatic parameter sliders, curve/tangent/area modes, four starting examples, reset, and validated view ranges. It can be placed by Part A in an exploration panel without adding a new shared visual action kind. The standalone preview exposes it at `http://127.0.0.1:4173/#function-lab`.

Invalid formulas keep the last working graph. Domain gaps remain split; this is a real-function explorer and does not add 3D, geometry, or probability tools.

## Tool argument examples

`near` is either `{ shapeId: "..." }` or `{ bbox: { x, y, w, h } }` in canvas coordinates.

```ts
visuals.run({
  type: "plot", id: "parabola", fn: "a*x^2",
  xRange: [-3, 3], params: { a: 1 }, near,
});
visuals.run({
  type: "animateParam", plotId: "parabola",
  param: "a", from: 1, to: 3, ms: 2000,
});
visuals.run({
  type: "showVisual", kind: "tangent",
  args: { id: "slope", fn: "x^2", at: -2, xRange: [-3, 3], yRange: [-2, 9] }, near,
});
visuals.run({
  type: "animateParam", plotId: "slope",
  param: "at", from: -2, to: 2, ms: 3000,
});
visuals.run({
  type: "showVisual", kind: "area",
  args: { id: "area", fn: "x^2", from: 0, to: 2, xRange: [-1, 3], yRange: [-1, 9] }, near,
});
visuals.run({
  type: "showVisual", kind: "numberLine",
  args: { id: "numbers", range: [-5, 5], values: [-2, 0, 2.5] }, near,
});
visuals.run({
  type: "showVisual", kind: "table",
  args: { id: "values", fn: "x^2", xs: [-2, -1, 0, 1, 2] }, near,
});
```

`args.params` supplies curve parameters for tangent, area, and table. `at`, `from`, and `to` are reserved visual parameters. `x` is the independent graph variable; `e` and `pi` are constants. A graph's axes stay fixed during animation. The shared `plot` action has no y-range field, so it uses [-4, 8]; ready-made curve visuals accept `args.yRange`, and standalone `Graph` accepts `yRange`.

Animations accept 0–60000 ms and finite values. Invalid requests are reported through `onError`, and a bad new visual can show a neutral error card. Closing a document is the cleanup boundary. Up to 24 visuals are retained per controller.

## Dependencies and commands

Production: `@cortex-js/compute-engine` (standalone LaTeX parser), `mathjs/number` (arithmetic/differentiation), `mafs`, `katex`.

Development: `tsx`, `esbuild`, `@playwright/test`, `@types/katex`. The `mafs.katex` override makes Mafs share the patched root KaTeX. npm still prints an upstream peer-range warning for Mafs's resize observer, whose metadata stops at React 18; browser tests pass on the project's React 19.3.1. No legacy-peer-deps flag or React downgrade is used.

Use Node 22.12+ (validated here with Node 24.14.1). No service keys are required for Part D.

```sh
npm install
npm run part-d:test
npm run part-d:preview
npm run part-d:e2e
npm run build
node .github/scripts/part-guard.mjs --local
```

The browser suite uses installed Microsoft Edge on Windows. On another platform, select an installed Playwright browser in the Part D test configuration. To record the preview: start it, run `npx playwright install ffmpeg` once, then `node src/components/visuals/preview/record.mjs`.

## Validation

- 73 math, argument, geometry, and animation tests pass.
- 16 browser tests pass: all visual types, keyboard sliders/tabs, math result states, integral answers, live updates without remounting, stop/reduced motion, malformed input, cleanup, tablet/phone layout, direct mouse/keyboard/touch dragging, interruption of queued narration, custom functions and parameters, view switching, and range validation.
- TypeScript and the production build pass.
- npm audit after dependency reconciliation reports zero vulnerabilities.
- The ownership audit includes staged, unstaged, and untracked files; every change is inside Part D folders, docs, or package manifests. The shared part guard and whitespace check pass.
- Screenshots were reviewed at 1440 px, 820 px, and 390 px. Graph endpoints have room for axis labels; smaller screens stack the lesson and checker.

The [captioned backup video](math-visuals-demo.webm) demonstrates Part D locally. Full voice/canvas/brain integration requires the other parts' real implementations and has not been claimed as tested here.
