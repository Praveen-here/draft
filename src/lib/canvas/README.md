# Part A: Canvas eyes and hands

**Branch:** `part-a/canvas` · **Spec:** [AGENT_BRAIN.md §8](../../../docs/AGENT_BRAIN.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

All nine documented Part A tasks are implemented for the local laptop/trackpad demo. The complete desktop pointer → canvas crop → Gemini → LaTeX flow has passed a live check. **The teaching loop, voice and real graphs remain teammate integrations.** The normal app never invents recognition results or pretends to record audio.

## Owned folders

- `src/lib/canvas/` — geometry, context, events, reading adapter and tutor drawing
- `src/components/app/` — existing screens, feedback and custom canvas shapes
- `src/app/app/` — app route, development test bench and recognition boundary

The shared contracts, fakes, session wiring, other parts' modules and global styles are unchanged.

## Implemented

| Feature | Implementation |
|---|---|
| Automatic circle detection | Finished draw strokes use tldraw 5.6's current path format. A circle can select one term inside a longer PDF text item. Small/ambiguous loops remain ink. |
| Selected context | Combined PNG includes student highlights; handwriting-only PNG excludes them. Also returns printed PDF text, world-coordinate bbox, 1-based PDF page number (0 for blank paper) and recent recognised lines. |
| PDF text | Text boxes retained alongside rendered pages; rotation and 2x raster scaling accounted for |
| Writing | Neighbouring strokes form separate equations, accounting for slanted baselines, superscripts and stacked fractions. Tall integrals cannot expand a whole line's horizontal reach. Reads after a 1.2-second pause. |
| Equation selection and blocks | The toggleable Layers sidebar lists handwriting previews and rendered results. Shift-click selects a range; Ctrl/⌘-click toggles entries. Group creates a collapsible, movable block while preserving separate recognition. Ungroup and undo retain the ink. |
| Events | `circle` for new/changed selections, `line` for freshly recognised writing, one `idle` after 8 seconds without pen/highlighter activity |
| Recognition lifecycle | Serialised requests, a position-independent cache, no new reads during dragging, and late-result rejection after actual ink changes. In-flight reads survive whole-equation moves. Unreadable old lines do not block new writing. |
| Handwriting reader | Server-side Gemini 3.5 Flash-Lite with minimal thinking; validates PNG input and LaTeX output, limits request size/time, reports quota errors without automatic retries |
| Tutor ink | Blue/green/red highlights, KaTeX equations revealed with a stroke mask, ticks/crosses/circles; reduced-motion support |
| Visual host | React-node custom shape, placed outside document/other work; same ID replaces, explicit unmount |
| Cleanup | Dispose listeners/timers/in-flight reads; clear tutor shapes without deleting student ink or undoing document pages |
| UI | Selection preview, visible reading status, clear tutor notes, Part C mic slot; drawing controls also work from the keyboard |

## Integration API

Import only from the public entry, `@/lib/canvas`. The shared `CanvasApi` contract is unchanged.

The Part A `CanvasHandle` adds `getEquations()` for the equation panel. Explicit ink
selection uses the existing `circle` event and `getLatestCircle()` context channel;
its ink crop and recent lines contain only the selected equations, even when another
equation lies between them. Selecting and grouping cached equations makes no provider
calls. Moving a whole equation or block reuses its result at the new coordinates,
even while recognition is already running. Partial moves recalculate membership
after dropping and read only uncached changed pieces; a symbol transferred to another
equation follows that equation's native layer group. The cache retains the 128 most
recent recognised arrangements for undo/redo. Equation boundaries are stored in stroke
metadata and participate in undo; the native group handles movement.

The normal `Canvas` component creates and disposes the API. Its optional
`onReady(api, editor)` callback hands the API to the lead's session wiring; return a
disconnect function. It runs on editor mount, before an uploaded PDF finishes loading.

Pass `recogniseInk(image, signal)` to `Canvas` to inject the agreed server transport.
It receives a PNG data URL and returns `Promise<string[]>`. Never put a provider key
in this client callback. For an editor mounted elsewhere, use:

```ts
import { createCanvasApi } from "@/lib/canvas";

const api = createCanvasApi(editor, {
  recogniseInk: serverTransport,
  onError: showStatus,
  onContext: showSelection,
});
const unsubscribe = api.onEvent((event) => brain.handleCanvas(event));
// At unmount: unsubscribe(); api.dispose();
```

### Recognition boundary

Default transport: `POST /app/read-ink`, body `{ image: "<PNG data URL>" }`, response
`{ lines: ["one LaTeX line"] }`. The owned server route calls `gemini-3.5-flash-lite`
using the existing `APP_ENV=dev` / `GEMINI_KEY_DEV` configuration in `.env.local`.
`APP_ENV=demo` selects only `GEMINI_KEY_DEMO`; missing credentials never fall back
to the other environment. Keys stay in the server's request header.

Use a Gemini project with billing disabled for the ₹0 requirement. There are no
automatic retries, paid-provider fallbacks or billing changes. An exhausted quota
returns 429; unavailable configuration returns 503; unreadable ink returns 422.
The server deadline is 15 seconds and the client deadline is 20 seconds.

Each call receives one grouped student line, excluding PDF pixels and tutor ink.
Crops are capped at 1024 pixels on the longest side; the server also caps the JSON
body at 2 MB, including requests without Content-Length. Empty, ambiguous or malformed
replies must fail, never produce a fabricated line event.

Unchanged unreadable lines are skipped during automatic reading, so they cannot
block newer lines. Editing a line or explicitly calling `api.readInk()` retries it.
Quota and connection failures still stop the queue rather than making more calls.

### Part C: microphone

Pass `voice={{ on, onToggle }}` to `Canvas` using Part C's real microphone state.
With no voice controller the button stays off and explains that voice is unavailable.
The current Part C placeholder has no keyboard handler; the canvas wrapper supplies it.
Remove that wrapper handler when Part C adds native keyboard activation.

### Part D: visuals

Use `api.mountVisual(id, near, node)` / `api.unmountVisual(id)`.
The current host is **360 × 260 canvas units**, with scrollable overflow. Make the
component responsive inside that box. React nodes live in an editor-scoped store,
not in serialised tldraw records. Clearing tutor ink also removes visuals.

## Run and verify

```bash
npm ci
npm run dev
node --import jiti/register --test src/lib/canvas/tests/*.test.ts
npm run build
node .github/scripts/part-guard.mjs --local
```

Open **/app/canvas-test** in development. Click **Run checks (resets test page)**.
It uses a generated two-page PDF (one rotated), actual tldraw shapes and exports,
and an explicitly simulated reader returning `x + C`. Manual circle, writing,
tutor and graph-placeholder buttons are also provided.

The test page returns 404 in production. Its simulated microphone only changes UI
state; it does not request permission, capture audio or contact any service.

The repository guard checks committed changes. Also inspect staged/unstaged and
untracked paths before committing so unrelated edits cannot slip in.

For the real laptop flow, open **/app**, choose **Start writing**, and hold the
trackpad click while dragging to write. Pause for recognition, then open **Layers**
at the upper right. Click an equation to select it, Shift-click another to select
the range, or Ctrl/⌘-click to toggle individual equations. Click **Group** to make
one movable block with separately recognised equations. The folder arrow expands
its members; **Ungroup** separates them without erasing writing. Closing and reopening
Layers keeps the selection. Arrow keys navigate the list, Shift+arrows extend the
selection, Escape closes the sidebar, and Ctrl/⌘+Z undoes changes.
The Select and move tool also supports dragging a selection rectangle. The test
bench deliberately uses simulated recognition.

## Remaining handoffs and limits

See [PART_A_HANDOFF.md](../../../docs/PART_A_HANDOFF.md). Live checks cover controlled
stroke samples, not every person's handwriting; review the displayed transcription.
Tablet/stylus testing is optional if hardware becomes available. Math checking,
teaching decisions, speech synchronization and real graph rendering remain with Parts B/C/D.
