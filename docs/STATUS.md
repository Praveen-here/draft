# Status: where we are (read this first in a new chat)

Last updated: 31 Oct 2026. Update this file whenever something big lands.

## The product in one paragraph

∂raft is a tablet math tutor (hackathon, Education track). The student opens a worksheet PDF, **circles** part of it with the pen and **asks** a question (voice or text). The **Agent Brain** explains with hints, never the full answer: it talks in short beats, highlights the page, draws graphs and slides values on them while speaking, asks "did you get it?" style check questions, adapts when the student is wrong, and stays in the loop until the student solves the step. The brain is the core feature. Full spec: [AGENT_BRAIN.md](AGENT_BRAIN.md). Decisions: [DECISIONS.md](DECISIONS.md) (D1–D27, open questions Q1–Q16).

## Branches

| Branch | What | Pushed? |
|---|---|---|
| `main` | Docs, rules, landing, folder scaffold, and **working brain v1 end to end** (all four parts, built by the lead) + zoom fix | ✅ |
| `feat/brain-v1` | Where brain v1 was built; fast-forwarded into `main` on 31 Oct | local |
| `part-a/canvas`, `part-b/agent-brain`, `part-c/voice`, `part-d/math-visuals` | One per teammate; scaffold only | ✅ |
| `docs/mic-toggle-auto-circle`, `docs/some-change` | Old, already merged; safe to delete | local |

The protect-main ruleset on GitHub is **not active yet** (direct pushes to main still work). Setup steps: [WORKING_RULES.md](WORKING_RULES.md).

## What works today (on `main`)

1. `npm run dev` → http://localhost:3000/app (Chrome or Edge) → **Open a PDF**. Test sheet: `samples/practice-sheet.pdf` (untracked; Q1–Q7 graphs/algebra/integration, Q8–Q11 worked answers with planted mistakes).
2. Draw a loop around a problem → it turns blue and shows under "You circled" in the panel.
3. Type or tap the mic and ask → in ~2–4 s the tutor speaks beat by beat, highlights, writes steps, draws a graph and animates a parameter, then asks a question.
4. Answer wrong on purpose → it marks it and re-explains on the **same** graph.

Tested results: [TEST_RESULTS.md](TEST_RESULTS.md) ("Brain v1 end to end").

## How it works (the flow)

```
Canvas (tldraw)  --circle-->  session.ts  --> brain.handleCanvas (stores crop image)
TutorPanel / mic --speech-->  session.ts  --> brain.handleSpeech --> POST /api/tutor --> Gemini (one structured call)
brain.onTurn --> player.play: speaks each beat (browser TTS) and fires its visuals on speech start
visuals: highlight / mark / writeStep -> tldraw shapes; plot / animate / tangent / area -> SVG Graph pinned on canvas
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
| A Canvas | `src/lib/canvas/`, `src/components/app/`, `src/app/app/` | `canvasApi.ts` (circle detect → crop → placement), `circleDetect.ts`, `tutorInk.ts`, `visualStore.ts`, `TutorOverlay.tsx` |
| B Brain | `src/lib/agent/`, `src/app/api/tutor/`, `src/app/bench/` | `brain.ts`, `prompt.ts`, `schema.ts`, `studentModel.ts`, `route.ts` |
| C Voice | `src/lib/voice/`, `src/lib/player/`, `src/components/voice/`, `src/app/api/voice/` | `tts.ts`, `mic.ts`, `player.ts`, `TutorPanel.tsx`, `MicButton.tsx` |
| D Math/visuals | `src/lib/math/`, `src/components/visuals/` | `Graph.tsx` (mathjs SVG), `plotState.ts`, `visualsApi.ts`; math engine is a stub |

Folder map: `.github/parts.json`. Each part's guide: the `README.md` in its main folder.

## Known gaps and next steps

- [ ] Proactive triggers not wired (`src/lib/agent/triggers.ts`): flag a wrong line, nudge after ~8–10 s idle, quiet ✓ on a right line.
- [ ] Math engine (`src/lib/math`) returns "unsure"; brain doesn't check steps yet.
- [ ] `readInk` / handwriting lines are stubs; PDF text isn't extracted into `pdfText` yet.
- [ ] Gradium voice instead of browser voice; STT `delay_in_frames` ~12.
- [ ] `/bench` test page is a placeholder.
- [ ] Not verified on a real iPad: pen circle detection and the no-zoom fix.
- [ ] Trade-off: with no room beside the page, a graph can cover the questions under the circle.
- [ ] Gemini Flash models were often 503 / slow on 31 Oct; Flash-Lite is fast and is first in the chain.
- [ ] Bring `main` into each `part-*` branch so teammates start from brain v1 (they run `git merge origin/main`).
- [ ] Turn on the protect-main ruleset; delete the old `docs/*` branches.

## Working rules for AI assistants (short)

- Push **only** when the lead says "push" in that message.
- Never print or commit key values; `.env.local` is git-ignored. Key names: `GEMINI_KEY_DEV/DEMO` etc. (see [SERVICES_AND_KEYS.md](SERVICES_AND_KEYS.md)).
- No personal, team or event names in the site or docs; say "the lead", "teammates".
- UI work uses the apple-design skill. Folder ownership: [WORKING_RULES.md](WORKING_RULES.md).
- Record new decisions in [DECISIONS.md](DECISIONS.md) and test results in [TEST_RESULTS.md](TEST_RESULTS.md); refresh this file.
