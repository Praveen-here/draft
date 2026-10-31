# Part B: The Agent Brain (core)

**Branch:** `part-b/agent-brain` · **Owner:** the lead · **Spec:** [AGENT_BRAIN.md](../../../docs/AGENT_BRAIN.md) (all of it) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

You decide **what happens next**: what to say, what to draw, when to ask, when to stay quiet, and when the student is done.

## Your folders (only edit these)

| Folder | What's in it |
|---|---|
| `src/lib/agent/` | The teaching loop, prompt, tools, student model, proactive triggers |
| `src/app/api/tutor/` | Server route that calls Gemini (keys stay on the server) |
| `src/app/bench/` | Test bench page at `/bench`: feed fake events, watch the turns |

## Try it (brain v1 works end to end)

1. `npm run dev`, open http://localhost:3000/app (Chrome or Edge), **Open a PDF**.
2. With the pen, **draw a loop around a problem**. It turns blue and appears under "You circled".
3. **Ask** in the panel (type, or tap the mic). ∂raft talks, highlights, draws graphs and slides values, then asks you something.
4. Answer it. Get it wrong on purpose and watch it explain differently.

How it works: `brain.ts` sends the circled picture + question + conversation + student model to `/api/tutor`
→ one Gemini call returns a structured turn (`schema.ts`) → `brain.ts` converts picture boxes to canvas positions
→ the player speaks each beat and fires its visuals. Dev only: `/api/tutor?model=…` forces one model.

## Files

| File | Does | Status |
|---|---|---|
| `index.ts` | Public entry. **Other parts may only import from here** | ✅ |
| `brain.ts` | `createBrain({ canvas, math })`: conversation, student model, calls `/api/tutor`, converts turns | ✅ v1 |
| `prompt.ts` | System prompt: the five rules, kinds of question, hint ladder, beats, visuals | ✅ v1 (keep tuning) |
| `schema.ts` | The JSON shape Gemini must return + request/response types | ✅ |
| `studentModel.ts` | `StudentModel` type, start value, save/load (localStorage) | ✅ |
| `tools.ts` | Tool list (reference; v1 uses one structured call instead, D25) | 🟡 |
| `triggers.ts` | When to act without being asked (wrong line, long pause, …) | ⬜ not wired yet |
| `../../app/api/tutor/route.ts` | `POST /api/tutor`: one Gemini call, model fallback, answer-leak guard | ✅ |
| `../../app/bench/page.tsx` | Test bench UI | 🟡 placeholder |

## What you give the others (`BrainApi`)

- `handleCanvas(event)`, `handleSpeech(said)`: inputs
- `onTurn(listener)`: outputs `TutorTurn`s (beats + what to wait for)
- `reset()`

## What you use from others (through `contracts.ts`)

- `CanvasApi` (Part A): `getLatestCircle`, `readInk`
- `MathApi` (Part D): `checkStep`, `checkAnswer`. **The engine wins** when it disagrees with Gemini
- Until they're ready: `fakeCanvas()`, `fakeMath()` from `src/lib/fakes.ts`

## Tasks, in order

1. [ ] `/api/tutor`: Gemini Flash with tool calling + streaming; Flash-Lite fallback on 429/5xx
2. [ ] `prompt.ts`: tune the rules; output must be beats (one sentence + visuals each), max ~4 beats per turn
3. [ ] `brain.ts`: the stages (understand → diagnose → explain → check → practice → verify → done)
4. [ ] Run tools locally (canvas / math), feed results back to Gemini, loop
5. [ ] Check questions: never accept a bare "yes"; follow up with a small question
6. [ ] `studentModel.ts`: hint level, tried angles, misconceptions; switch angle after two misses
7. [ ] `triggers.ts`: wrong line → gentle flag; idle ~8–10 s → offer a nudge; correct line → quiet ✓
8. [ ] "Explain it back" judging (open question Q14)
9. [ ] `/bench`: buttons for "circle", "line", "idle", a text box for speech; show the turns that come back

## Test alone

Open `/bench`. Wire `createBrain({ canvas: fakeCanvas(), math: fakeMath() })` and print the turns.
