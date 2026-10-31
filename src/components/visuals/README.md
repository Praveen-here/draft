# Visuals (Part D)

Teaching components placed through `CanvasApi.mountVisual(id, near, node)`. Public exports come from `@/components/visuals`; math comes from `@/lib/math`.

## Implemented

- `Graph`: function plot over `xRange`, optional `params`, `yRange`, and slider callback.
- `createVisualsApi(canvas)`: handles `plot`, `animateParam`, and all four `showVisual` kinds.
- Tangent lines with live point and slope values; undefined tangents at cusps are omitted.
- Shaded area, number lines, and value tables.
- Directly draggable curve probes, tangent points, and area boundaries, with mouse, touch, and keyboard control.
- `FunctionExplorer`: custom functions with automatic coefficient sliders, curve/tangent/area modes, four examples, reset, and view ranges.
- `onInteraction` lets the composition owner pause narration and queued visual beats when the student takes control.
- KaTeX HTML/MathML labels, keyboard controls, and reduced-motion behavior.
- Parameter animations update a mounted store; they do not remount the graph every frame. Retargeting starts from the current value and carries velocity forward.
- Curves and shaded polygons split at poles and non-real values.

## Quick use

```tsx
"use client";
import { Graph } from "@/components/visuals";

<Graph fn="a*x^2" xRange={[-3, 3]} params={{ a: 1 }} />
```

In the app composition, create one controller per document:

```ts
const visuals = createVisualsApi(canvas);
visuals.run({ type: "plot", id: "curve", fn: "a*x^2", xRange: [-3, 3], params: { a: 1 }, near });
visuals.run({ type: "animateParam", plotId: "curve", param: "a", from: 1, to: 3, ms: 2000 });
visuals.stop();    // pause or barge-in
visuals.dispose(); // close/reset the document: cancel and unmount owned visuals
```

When a parameter already exists, `animateParam` starts at its current displayed value. `from` initializes a new parameter. A zero duration or reduced-motion preference applies `to` immediately.

For a ready-made visual, give `args.id` when it should be animated or replaced later. Tangents animate `at`; areas animate `from` or `to`. Full argument examples and owner integration steps: [INTEGRATION.md](../../../docs/part-d/INTEGRATION.md).

## Files

| File | Purpose |
|---|---|
| `Graph.tsx` | Graph and ready-made visual components |
| `DragHandle.tsx` | Accessible direct manipulation in graph coordinates |
| `FunctionExplorer.tsx` | Editable functions, parameter controls, and exploration modes |
| `explorer.module.css` | Scoped Function Lab layout |
| `MathText.tsx` | Untrusted KaTeX rendering with MathML |
| `visualsApi.ts` | Tool dispatch, canvas mounting, lifecycle |
| `model.ts` | Validated tool argument shapes |
| `animation.ts` | Per-visual state and interruptible spring animation |
| `geometry.ts` | Curve sampling, area polygons, and finite tangents |
| `visuals.module.css` | Scoped visual styles and contrast support |
| `preview/` | Standalone studio, temporary adapters, browser tests, recording |

Run `npm run part-d:preview` and visit http://127.0.0.1:4173. Tests: `npm run part-d:test` and `npm run part-d:e2e`.

Mafs and KaTeX CSS are imported by the components; no edit to the lead-owned global stylesheet is required. Visuals explain ideas and show sampled values; they never automatically write a full solution.
