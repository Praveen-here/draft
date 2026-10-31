# Visuals (Part D)

Owned by **Part D**. Main doc: [src/lib/math/README.md](../../lib/math/README.md).

The pictures the brain draws while it talks. Each one is a React component placed on the canvas through Part A's `canvas.mountVisual(id, near, node)`.

| File | What it is |
|---|---|
| `index.ts` | Public entry: `createVisualsApi`, `Graph` |
| `visualsApi.ts` | `createVisualsApi(canvas)` → `VisualsApi`: turns `plot` / `animateParam` / `showVisual` into mounted components |
| `Graph.tsx` | Plots `fn` over `xRange`; `params` (e.g. `a`) can change smoothly while ∂raft speaks |

Visuals **teach the idea; they never show the final answer.** UI follows the apple-design skill: calm colours (tutor blue/green), springs for value changes, reduced-motion support.
