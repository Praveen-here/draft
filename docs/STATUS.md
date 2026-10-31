# Status: where we are (read this first in a new chat)

Last updated: 1 Nov 2026. Update this file whenever something big lands.

## The product in one paragraph

∂raft is a tablet math tutor (hackathon, Education track). The student opens a worksheet PDF, **circles** part of it with the pen and **asks** a question (voice or text). The **Agent Brain** explains with hints, never the full answer: it talks in short beats, highlights the page, draws graphs and slides values on them while speaking, asks "did you get it?" style check questions, adapts when the student is wrong, and stays in the loop until the student solves the step. The brain is the core feature. Full spec: [AGENT_BRAIN.md](AGENT_BRAIN.md). Decisions: [DECISIONS.md](DECISIONS.md) (D1–D32, open questions Q1–Q16).

## Branches

| Branch | What | Pushed? |
|---|---|---|
| `main` | Docs, rules, landing, folder scaffold, and **working brain v1 end to end** (all four parts, built by the lead) + zoom fix | ✅ |
| `feat/brain-v1` | Where brain v1 was built; fast-forwarded into `main` on 31 Oct | local |
| **`integrate/all`** | **Everything together (D32):** explain cards + the lead's math engine + Part A's canvas (from `origin/part-a/canvas`) + Part D's visuals (from `origin/part-d/math-visuals`). Next step: review, then merge into `main` | local |
| `feat/explain-cards` | Lesson column + explain cards + ask pill (D30); included in `integrate/all` | local |
| `part-a/canvas` (remote) | Part A's canvas work (`d6165a0`), built on the scaffold; merged into `integrate/all` | ✅ |
| `part-d/math-visuals` | Remote: Part D's visuals + checker (`c793b3f`). Local: the lead's math engine (`a097616`), not pushed. Both merged into `integrate/all` | ✅ / local |
| `part-b/agent-brain`, `part-c/voice` | Scaffold only | ✅ |
| `docs/mic-toggle-auto-circle`, `docs/some-change` | Old, already merged; safe to delete | local |

The protect-main ruleset on GitHub is **not active yet** (direct pushes to main still work). Setup steps: [WORKING_RULES.md](WORKING_RULES.md).

## What works today (on `integrate/all`)

1. `npm run dev` → http://localhost:3000/app (Chrome or Edge) → **Open a PDF**. Test sheet: `samples/practice-sheet.pdf` (untracked; Q1–Q7 graphs/algebra/integration, Q8–Q11 worked answers with planted mistakes).
2. Draw a loop around a problem (a whole line, or a single term) → it turns blue and a **lesson card** appears beside it with starter questions. The circled PDF text is read exactly (Part A).
3. Type in the ask pill, tap a starter or tap the mic → in ~2–5 s the tutor speaks beat by beat; numbered **explain cards** for the key letters/numbers/rules appear under the lesson card, with matching numbered marks snapped onto the exact term in the PDF; Part D's interactive graphs (drag the point, sliders, tangent, area) join the column. A tall column scrolls on its own and returns to the lesson card for "Your turn".
4. Answer → the lesson card shows only the current exchange; circling another problem swaps the whole column.
5. Handwriting is grouped into lines and read to LaTeX by `/app/read-ink` (Part A); the **Layers** panel (top right) lists the recognised equations. The brain doesn't act on them yet.
6. Part D's standalone math studio: `npm run part-d:preview` → http://127.0.0.1:4173.

Tested results: [TEST_RESULTS.md](TEST_RESULTS.md) ("Brain v1 end to end").

## How it works (the flow)

```
Canvas (tldraw)  --circle-->  session.ts  --> brain.handleCanvas (stores crop image)
AskBar / mic     --speech-->  session.ts  --> brain.handleSpeech --> POST /api/tutor --> Gemini (one structured call)
brain.onTurn --> player.play: speaks each beat (browser TTS) and fires its visuals on speech start
handwriting --1.2 s pause--> /app/read-ink (Gemini) --> "line" events (+ Layers panel); 8 s still --> "idle" events
visuals: highlight / mark -> tldraw shapes; note / writeStep / plot -> lesson column beside the circle (TutorOverlay)
```

- **One Gemini call per turn** (D25), JSON schema in `src/lib/agent/schema.ts`: `kind, doubt, studentWas, stage, hintLevel, angle, misconception, done, beats[{say, visuals}], waitFor, question`. Boxes come back as `[ymin, xmin, ymax, xmax]` 0–1000 on the circled picture; `brain.ts` maps them to canvas coordinates.
- **Model chain** (`src/app/api/tutor/route.ts`): `gemini-3.5-flash-lite` (7 s) → `gemini-3.8-flash` (9 s) → lite again (12 s) → `gemini-3.1-flash-lite` (12 s). Answer-leak guard: max 4 beats, max 1 written step. Dev override: `/api/tutor?model=…`.
- **Student model** carried between turns: hint level, angles tried, misconceptions, checks passed/failed. Graphs already on screen are sent so Gemini reuses the same `plotId`.
- **Voice is a stand-in** (D27): browser `speechSynthesis` + `webkitSpeechRecognition`. Gradium (tested, works on free plan) replaces it later.
- **Canvas never moves on its own** (fix `ebe3228`): no auto zoom/pan. Tutor graphs and steps go in the visible area beside the page, else right of / below / above the circle. Reply box font is 16 px and isn't auto-focused on touch (iOS zooms inputs under 16 px).

## Where the code is

| Part | Folders | Key files |
|---|---|---|
| Lead-only | `src/lib/contracts.ts`, `fakes.ts`, `session.ts`, `src/lib/server/keys.ts`, `src/components/session/TutorSession.tsx` | contracts = the only way parts talk |
| A Canvas | `src/lib/canvas/`, `src/components/app/`, `src/app/app/` | `canvasApi.ts` (strokes, circles, context, lines, lesson column), `context.ts` (PDF text, crops), `snapTerm.ts`, `equations.ts`/`lines.ts`/`readInk.ts` + `app/read-ink/route.ts` (handwriting), `TutorOverlay.tsx`, `NoteCard.tsx`, `EquationPanel.tsx` (Layers), `TutorInkShape.tsx`; guide: [PART_A_HANDOFF.md](PART_A_HANDOFF.md) |
| B Brain | `src/lib/agent/`, `src/app/api/tutor/`, `src/app/bench/` | `brain.ts`, `prompt.ts`, `schema.ts`, `studentModel.ts`, `route.ts` |
| C Voice | `src/lib/voice/`, `src/lib/player/`, `src/components/voice/`, `src/app/api/voice/` | `tts.ts`, `mic.ts`, `player.ts`, `LessonCard.tsx`, `AskBar.tsx`, `MicButton.tsx` |
| D Math/visuals | `src/lib/math/`, `src/components/visuals/` | Checker: `checkStep.ts`, `lineParse.ts`, `sampling.ts`. Visuals (Mafs + KaTeX): `Graph.tsx`, `visualsApi.ts`, `model.ts`, `animation.ts`, `FunctionExplorer.tsx`, `preview/`; graph parser `parse.ts`, `calculus.ts`; guide: [part-d/INTEGRATION.md](part-d/INTEGRATION.md) |

Folder map: `.github/parts.json`. Each part's guide: the `README.md` in its main folder.

## Known gaps and next steps

- [ ] Proactive triggers not wired (`src/lib/agent/triggers.ts`): flag a wrong line, nudge after ~8–10 s idle, quiet ✓ on a right line.
- [x] Math engine (D28, D29): `npx tsx src/lib/math/check.test.ts` (75 cases). Part A + D unit tests: `npx tsx --test src/lib/math/math.test.ts src/components/visuals/visuals.test.ts src/lib/canvas/tests/*.test.ts` (60).
- [x] Handwriting → LaTeX and PDF text (`pdfText`, term positions) from Part A.
- [ ] Brain doesn't use the engine or the handwriting lines yet (Part B): check typed answers, flag wrong lines, `done` only when the engine agrees.
- [ ] Every handwritten line is sent to Gemini after a 1.2 s pause (cached, no retries); watch the free quota during practice.
- [ ] Part A's browser checks (`/app/canvas-test`) and Part D's Playwright suite (`npm run part-d:e2e`) weren't re-run after the merge; `npm run build` not run yet.
- [ ] Gradium voice instead of browser voice; STT `delay_in_frames` ~12.
- [ ] `/bench` test page is a placeholder.
- [ ] Not verified on a real iPad: pen circle detection and the no-zoom fix.
- [ ] Trade-off: with no room beside the page, the lesson column covers the right edge of the page; a tall column shrinks to 82%, then scrolls.
- [ ] Explain-card marks snap to the PDF's text; terms that aren't printed (a formula, handwriting) still use Gemini's box, which can be a word off.
- [ ] Gemini Flash models were often 503 / slow on 31 Oct; Flash-Lite is fast and is first in the chain.
- [ ] Merge `integrate/all` into `main`, then teammates merge `main` into their `part-*` branches (`git merge origin/main`).
- [ ] Turn on the protect-main ruleset; delete the old `docs/*` branches.

## Working rules for AI assistants (short)

- Push **only** when the lead says "push" in that message.
- Never print or commit key values; `.env.local` is git-ignored. Key names: `GEMINI_KEY_DEV/DEMO` etc. (see [SERVICES_AND_KEYS.md](SERVICES_AND_KEYS.md)).
- No personal, team or event names in the site or docs; say "the lead", "teammates".
- UI work uses the apple-design skill. Folder ownership: [WORKING_RULES.md](WORKING_RULES.md).
- Record new decisions in [DECISIONS.md](DECISIONS.md) and test results in [TEST_RESULTS.md](TEST_RESULTS.md); refresh this file.
