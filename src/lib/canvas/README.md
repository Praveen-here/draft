# Part A: Canvas eyes and hands

**Branch:** `part-a/canvas` · **Owner:** _to assign_ · **Spec:** [AGENT_BRAIN.md §8](../../../docs/AGENT_BRAIN.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

You are the brain's **eyes on the page** and its **pen**. You notice what the student draws and writes, and you draw what the tutor wants to show.

## Your folders (only edit these)

| Folder | What's in it |
|---|---|
| `src/lib/canvas/` | Logic: circle detection, line grouping, reading ink, tutor ink, the `CanvasApi` |
| `src/components/app/` | The canvas screen: start screen, toolbar, paper, `Canvas.tsx` (already built) |
| `src/app/app/` | The `/app` page |

## Files

| File | Does | Status |
|---|---|---|
| `index.ts` | Public entry. **Other parts may only import from here** | ✅ |
| `canvasApi.ts` | `createCanvasApi(editor)`: implements `CanvasApi` from `contracts.ts` | ⬜ stub |
| `circleDetect.ts` | `looksLikeCircle(points)`: is a stroke a circle around content? (D16) | ⬜ stub |
| `lines.ts` | Groups the student's strokes into lines of writing | ⬜ stub |
| `readInk.ts` | Handwriting crop → LaTeX (Gemini vision, via a server route) | ⬜ stub |
| `tutorInk.ts` | Draws `highlight`, `writeStep` (animated handwriting), `mark` in tutor colours | ⬜ stub |

## What you give the others (`CanvasApi` in `src/lib/contracts.ts`)

- `onEvent(listener)`: fires `circle`, `line` and `idle` events
- `getLatestCircle()`: `CircleContext` (crop image, ink-only image, PDF text, bbox, page, recent lines)
- `readInk(region?)`: lines as LaTeX
- `draw(action)`: `highlight` / `writeStep` / `mark`
- `clearTutorInk()`
- `mountVisual(id, near, node)` / `unmountVisual(id)`: Part D's graphs appear on the canvas through these

## What you use from others

Nothing yet. You produce events; the brain consumes them. Mount Part C's mic button from `@/components/voice` when it's ready (public entry only).

## Tasks, in order

1. [ ] Create the `CanvasApi` in `Canvas.tsx` `onMount` and expose it (e.g. via a callback prop / React context)
2. [ ] Listen to finished draw strokes (`editor.sideEffects` / store listener); tag each as `circle` or `ink` in `meta`
3. [ ] `looksLikeCircle`: start/end within ~15% of stroke size, encloses an area, overlaps text/ink (tune on the tablet)
4. [ ] On a circle: build `CircleContext`: export the crop (`editor.toImage`), ink-only crop, PDF text in the box
5. [ ] `lines.ts`: group strokes by vertical position into lines; emit a `line` event after a short pause
6. [ ] `idle` events: no pen activity for N seconds
7. [ ] `tutorInk.ts`: highlights, ticks, crosses, circles; `writeStep` with stroke-dash animation (Caveat/Kalam)
8. [ ] `mountVisual`: a tldraw custom shape that renders a React node (for Part D's graphs)
9. [ ] PDF text: keep pdf.js text items per page in `loadPages.ts` so step 4 can look them up

## Test alone

Log your events: `api.onEvent(console.log)`. Feed `sampleTurn` from `src/lib/fakes.ts` to your `draw()` to test tutor ink without the brain.
