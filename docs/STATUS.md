# Status: where we are (read this first in a new chat)

Last updated: 1 Nov 2026 (evening). Update this file whenever something big lands.

## The product in one paragraph

∂raft is a tablet math tutor (hackathon, Education track). The student opens a worksheet PDF, **circles** part of it with the pen and **asks** a question (voice or text). The **Agent Brain** explains with hints, never the full answer: it talks in short beats, marks the exact terms on the page, draws graphs and slides values on them while speaking, asks check questions, adapts when the student is wrong, and stays in the loop until the student solves the step. The brain is the core feature. Spec: [AGENT_BRAIN.md](AGENT_BRAIN.md). Decisions: [DECISIONS.md](DECISIONS.md) (D1–D34; open questions Q1–Q16). How to test: [TESTING.md](TESTING.md).

## Where the work is: `main` (pushed)

Everything current is on **`main`** on GitHub: on 1 Nov the lead had `integrate/all` fast-forwarded into `main` and pushed directly (no pull request). `npm run dev` on a fresh clone of `main` runs the full app (plus your own `.env.local`; `npm install` copies the pdf.js worker into `public/`).

| Branch | What | Pushed? |
|---|---|---|
| **`main`** | **Use this.** Brain v1 + the lead's math engine + Part A's canvas + Part D's visuals + message-bubble chat + graph panel + dragging + D35 | ✅ |
| `integrate/all` | Same as `main` (the lead's working branch) | ✅ via `main` |
| `main` | Brain v1 end to end (old side chat panel), docs, rules, landing | ✅ |
| `feat/explain-cards` | Superseded: the first card UI (D30), inside `integrate/all` | local |
| `part-d/math-visuals` | Local: the lead's math engine (`a097616`, not pushed). Remote: Part D's teammate work (`c793b3f`). Both merged into `integrate/all` | local / ✅ |
| `part-a/canvas` (remote) | Part A's teammate work (`d6165a0`), merged into `integrate/all` | ✅ |
| `part-b/agent-brain`, `part-c/voice` | Scaffold only | ✅ |
| `feat/brain-v1`, `docs/*` | Old, already merged; safe to delete | local |

Leftover: `git stash list` shows `stash@{0}` (Part D files that leaked onto another branch; identical to `a097616`). Safe to `git stash drop`.

**Next git steps:** teammates run `git merge origin/main` on their `part-*` branches (Part A's newer `905c632` on `part-a/canvas` is not in `main` yet). Their branches were built on the old scaffold, so they'll see the new contract (`note` visual, `writeStep.text`), the lesson store and the graph panel.

## What works today (on `integrate/all`)

Run `npm run dev` → http://localhost:3000/app (Chrome/Edge) → **Open a PDF** → `samples/practice-sheet.pdf` (in the repo; Q1–Q7 problems; Q8–Q11 worked answers with one planted mistake each).

1. **Circle** a problem (a whole line or one term) with the pen → the loop turns blue; a **message thread** appears beside it: a white bubble "What would you like to know about this?" plus four reply pills (How do I start? / Why this step? / What do these mean? / Is this right?).
2. **Ask** by typing in the floating **ask pill** (bottom), tapping a pill, or the mic → a typing bubble, then in ~2–5 s the tutor answers **one white bubble per spoken sentence** (iMessage style, tail bottom-left; the student's bubbles are blue, tail bottom-right).
   - **Explain cards** are bubbles numbered ①②…; the same number is drawn on the exact term in the PDF (tinted outline + badge), snapped to the PDF's own text positions.
   - **Graphs** (Part D, Mafs: drag the point, sliders, tangent, area) open in a **separate graph panel**: a glass panel on the right on wide screens (≥ 900 px), a sheet above the ask pill on tablets/phones. A "Graph: y = a·x²" link bubble opens it.
   - The thread ends with a "Your turn" note; circling another problem replaces the whole thread; ✕ on the thread's pill closes it. After "Solved", the next question also starts fresh (new thread, brain forgets the old circle/history/graphs). A new problem drops any answer still loading for the old one.
   - The graph panel never scrolls (D35): the plot shrinks so the whole card fits; short panels drop the title, legend and drag hint; several graphs show one at a time with ‹ 1 / 2 ›.
3. **Placement:** the thread is placed in screen space beside the circle (right, left, below or above; wherever there's room, never on the circle, round the graph panel), follows the page every frame while scrolling, and scrolls itself when long. When the circle is off screen (scrolled or zoomed away) the thread hides and a "Back to your question" pill brings the circle back into view; zoomed in so far there's no room round the circle, it floats as a full card in the bottom corner.
4. **Dragging (D34):** drag the chat by its "∂raft" pill (sticky at the top), and the graph panel by its header. Both track 1:1, rubber-band at edges and carry a flick into a spring. A moved chat keeps its offset from the circle; double-click the pill to auto-place again. The panel floats where dropped and re-docks when dropped near its edge.
5. **Handwriting** is grouped into lines and read to LaTeX by `/app/read-ink` (Gemini) after a 1.2 s pause; the **Layers** button (top right) lists recognised equations; "Reading your writing…" shows as a small toast. The brain doesn't act on lines yet.
6. Part D's standalone math studio: `npm run part-d:preview` → http://127.0.0.1:4173.

Checked live at 1440×900, 820×1180 and a phone-like width ([TEST_RESULTS.md](TEST_RESULTS.md), 1 Nov).

## How it works

```
<Canvas> (Part A) creates the CanvasApi on mount → <TutorSession canvas> (lead) builds brain, player, visuals, connects them
pen loop ──► canvasApi: circle detect + PDF text + crops ──► "circle" event ──► brain (stores context) + thread mounted
ask pill / mic / reply pill ──► player.say ──► brain.handleSpeech ──► POST /api/tutor ──► Gemini, one structured call
brain.onTurn ──► player.play: speaks each beat (browser TTS) and fires its visuals as the sentence starts
   highlight / mark   → tutor-ink shapes on the page (Part A)
   note               → numbered mark on the term (overlay) + a bubble in the thread
   writeStep          → a bubble (handwriting font)
   plot / tangent / area / animateParam → Part D visuals in the graph panel
handwriting --1.2 s pause--> /app/read-ink ──► "line" events (+ Layers);  8 s still ──► "idle" events  (brain ignores both for now)
```

- **Brain** (`src/lib/agent`): one Gemini call per turn (D25), JSON schema in `schema.ts` (`kind, doubt, studentWas, stage, hintLevel, angle, misconception, done, beats[{say, visuals}], waitFor, question`). Visual types Gemini may use: highlight, mark, writeStep, **note** (explain card), plot, animate, tangent, area (`prompt.ts`). Boxes are `[ymin,xmin,ymax,xmax]` 0–1000 on the circled crop; `brain.ts` maps them to the page and adapts tangent/area/plot to Part D's format (tangent/area become full visuals replacing their plot in place; the tangent's param becomes `at`).
- **Guards** (`src/app/api/tutor/route.ts`): max 4 beats, 1 written step, 4 notes per turn. Model chain: `gemini-3.5-flash-lite` (7 s) → `3.8-flash` → lite → `3.1-flash-lite`.
- **Student model** carried between turns: hint level, angles tried, misconceptions, checks passed/failed, graphs on screen.
- **Math checker** (`src/lib/math`, D28/D29): numbers at seeded random points; ∫ lines compared up to a constant; equations by real roots; `dy/dx = …`; worded questions; missing `+ C`. Catches all 4 planted practice-sheet mistakes. **Not wired into the brain yet.**
- **Voice** is a stand-in (D27): browser `speechSynthesis` + `webkitSpeechRecognition`; the mic ignores what it hears while the tutor talks. Gradium is the target.
- **The canvas never moves on its own** (no auto zoom/pan).

## The UI on screen (all floating over the canvas)

| Thing | Where | File |
|---|---|---|
| Top bar (back, title, paper picker, fit) | top | `src/components/app/Canvas.tsx` |
| Layers button + panel (recognised equations) | top right | `src/components/app/EquationPanel.tsx` (Part A) |
| Status toast ("Reading your writing…", notices) | under the top bar | `src/components/app/CanvasFeedback.tsx` |
| Message thread (bubbles, pills, typing, solved) | beside the circle | `src/components/voice/LessonCard.tsx` (content), placed by `src/components/app/TutorOverlay.tsx` |
| Numbered term marks | on the page | `TutorOverlay.tsx` (`TermMarks`), colours `noteTone.ts` |
| Graph panel / sheet | right, or above the ask pill | `TutorOverlay.tsx` (`GraphPanel`); graph cards `src/components/visuals/Graph.tsx` |
| Ask pill (mic, text, send) | bottom centre, above the toolbar | `src/components/voice/AskBar.tsx` |
| Toolbar (pen, highlighter, eraser, colours, sizes, undo) | bottom | `src/components/app/Toolbar.tsx` |

Safe area for floating UI (set in `TutorSession.tsx`): top 136 px (bars + Layers), bottom 168 px (toolbar + ask pill), sides 12 px. Dragging helper: `src/components/app/drag.ts`. Style: apple-design skill (springs with no bounce except flicks/ticks, glass for chrome, white cards on the page, reduced-motion fallbacks).

## Where the code is

| Part | Folders | Key files |
|---|---|---|
| Lead-only | `src/lib/contracts.ts`, `fakes.ts`, `session.ts`, `src/lib/server/keys.ts`, `src/components/session/TutorSession.tsx`, `scripts/` | contracts = the only way parts talk |
| A Canvas | `src/lib/canvas/`, `src/components/app/`, `src/app/app/` | `canvasApi.ts` (strokes, circles, context, lines, idle, the lesson store), `visualStore.ts` (anchor, items, safe area), `circleDetect.ts`, `context.ts` (PDF text, crops), `snapTerm.ts`, `equations.ts`/`lines.ts`/`readInk.ts` + `app/read-ink/route.ts`, `tutorInk.ts` + `TutorInkShape.tsx`, `TutorOverlay.tsx`, `drag.ts`; guide [PART_A_HANDOFF.md](PART_A_HANDOFF.md) |
| B Brain | `src/lib/agent/`, `src/app/api/tutor/`, `src/app/bench/` | `brain.ts`, `prompt.ts`, `schema.ts`, `studentModel.ts`, `triggers.ts` (unused), `route.ts` |
| C Voice | `src/lib/voice/`, `src/lib/player/`, `src/components/voice/` | `tts.ts`, `mic.ts`, `player.ts`, `LessonCard.tsx`, `AskBar.tsx`, `MicButton.tsx` |
| D Math/visuals | `src/lib/math/`, `src/components/visuals/` | Checker `checkStep.ts`, `lineParse.ts`, `sampling.ts`; visuals `Graph.tsx`, `visualsApi.ts`, `model.ts`, `animation.ts`, `FunctionExplorer.tsx`, `preview/`; graph parser `parse.ts`, `calculus.ts`; guide [part-d/INTEGRATION.md](part-d/INTEGRATION.md) |

Folder map: `.github/parts.json`. Each part's guide: the `README.md` in its main folder.

## Next steps (roughly in order)

- [ ] **Brain uses the math engine and handwriting** (Part B): judge typed/spoken answers with `checkAnswer`; on a `line` event run `checkStep` → quiet ✓ or a gentle flag (`triggers.ts`); offer a hint after an `idle` event; `done` only when the engine agrees. This is the "agentic" core still missing.
- [x] `integrate/all` → `main`, pushed (1 Nov). Teammates merge `origin/main`.
- [ ] Re-run Part A's browser checks (`/app/canvas-test`), Part D's Playwright suite, and `npm run build`.
- [ ] Gradium voice instead of the browser voice (STT `delay_in_frames` ~12).
- [ ] Try on a real iPad: pen circles, dragging by finger/pen, the no-zoom behaviour, safe areas.
- [ ] `/bench` test page is a placeholder.
- [ ] Turn on the protect-main ruleset; delete old branches; drop `stash@{0}`.

## Known trade-offs

- On a laptop the graph panel takes the page's right margin, so the thread moves below the circle (over the next questions) while a graph is shown; drag either one away, or fold the panel.
- On phones the thread gets little height while the graph sheet is open (it scrolls; the sheet folds).
- Term marks snap to the PDF's printed text; terms that aren't printed (a rule, handwriting) use Gemini's box, which can be a word off.
- Every handwritten line costs a Gemini call (cached, no retries); watch the free quota.
- Gemini Flash was often 503/slow on 31 Oct; Flash-Lite answers in ~2–4 s and is first in the chain.

## Working rules for AI assistants (short)

- Commit when asked or as part of a requested change on a lead branch; **push only when the lead says "push"** in that message. Never commit to `main` directly.
- Never print or commit key values; `.env.local` is git-ignored. Keys: `GEMINI_KEY_DEV/DEMO` etc. ([SERVICES_AND_KEYS.md](SERVICES_AND_KEYS.md)).
- No personal, team or event names in the site or docs; say "the lead", "teammates".
- UI work uses the apple-design skill. Folder ownership: [WORKING_RULES.md](WORKING_RULES.md) (lead branches like `integrate/all` may touch every part).
- Record decisions in [DECISIONS.md](DECISIONS.md), test results in [TEST_RESULTS.md](TEST_RESULTS.md); refresh this file.
- Shell gotchas (Git Bash eats backslashes in heredocs, etc.): [TESTING.md §3](TESTING.md).
