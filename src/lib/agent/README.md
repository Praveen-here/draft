# Part B: The Agent Brain (core)

**Branch:** `part-b/agent-brain` · **Owner:** the lead · **Spec:** [AGENT_BRAIN.md](../../../docs/AGENT_BRAIN.md) (all of it) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

You decide **what happens next**: what to say, what to draw, when to ask, when to stay quiet, and when the student is done.

## Your folders (only edit these)

| Folder | What's in it |
|---|---|
| `src/lib/agent/` | The teaching loop, prompt, tools, student model, proactive triggers |
| `src/app/api/tutor/` | Server route that calls Gemini (keys stay on the server) |
| `src/app/bench/` | Test bench page at `/bench`: feed fake events, watch the turns |

## Files

| File | Does | Status |
|---|---|---|
| `index.ts` | Public entry. **Other parts may only import from here** | ✅ |
| `brain.ts` | `createBrain({ canvas, math })`: implements `BrainApi`; runs the teaching loop | ⬜ stub |
| `prompt.ts` | System prompt: the five rules, stages, beat format | 🟡 first draft |
| `studentModel.ts` | `StudentModel` type, start value, save/load (localStorage) | 🟡 type + storage |
| `tools.ts` | Tool declarations Gemini can call (`readInk`, `checkStep`, `plot`, …) | 🟡 names + descriptions |
| `triggers.ts` | When to act without being asked (wrong line, long pause, …) | ⬜ stub |
| `../../app/api/tutor/route.ts` | `POST /api/tutor`: Gemini Flash with tools, streams beats back | ⬜ returns 501 |
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
