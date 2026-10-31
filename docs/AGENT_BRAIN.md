# The Agent Brain (our core feature)

> This is **the heart of ∂raft** and where most of our time goes. Everything else (canvas, voice, graphs) exists to give the brain eyes, a voice and a whiteboard.
> Decided by the lead on 31 Oct 2026 (D19 to D23 in [DECISIONS.md](DECISIONS.md)). Details marked **[OPEN]** are still to settle.

---

## 1. What the brain is, in one paragraph

The brain is a tutor that **knows what to say next**. It explains the step the student is stuck on with **hints and single steps, never the full solution**. It **talks while it draws**: graphs, highlights and values that change on screen as it speaks. It **asks questions as it goes** ("Did you get why the sign flipped?") and changes its plan based on the answer. It **acts on its own**: it chooses when to draw a graph, when to ask, and when to step in, without the student having to ask for each thing. It **stays in the loop** until the student has **solved the step themselves** or can **explain it in their own words**.

---

## 2. The five rules the brain always follows

1. **Never give the full solution.** At most one worked step at a time, then hand back: "Your turn."
2. **Show, don't just tell.** If a picture helps (a graph, a highlight, a value changing), the brain draws it while it talks. Nobody has to ask for it.
3. **Check understanding; don't trust "yes".** After explaining, ask a short check question. "Did you get it?" is fine as a warm opener, but "yes" alone doesn't count. Follow up with a tiny question that proves it ("So what's du here?").
4. **Adapt.** A wrong answer or "no" means a different explanation, not the same one louder: a smaller step, a different picture, a simpler example.
5. **Finish only when the student can do it.** Done = the math engine confirms the student's own line, **or** the student explains the idea back correctly.

---

## 3. The teaching loop

```
        ┌──────────────────────────────────────────────────────────┐
        ▼                                                          │
 1. UNDERSTAND   What exactly is the doubt?                        │
                 (circled area + question + earlier lines)         │
        ▼                                                          │
 2. DIAGNOSE     What does the student already know?               │
                 Sometimes ask first: "What do you think comes     │
                 next?"                                            │
        ▼                                                          │
 3. EXPLAIN      Talk + draw at the same time                      │
                 (graph, highlight, slide a value, write one step) │
        ▼                                                          │
 4. CHECK        Ask: "Did you get it?" → then a check question    │
                 Listen to the answer (voice) or watch the pen     │
        ▼                                                          │
 5. PRACTICE     "Your turn: write the next line."                 │
        ▼                                                          │
 6. VERIFY       Math engine checks the line                       │
        │                                                          │
        ├── correct + student can explain ──► 7. DONE: ✓ + praise  │
        └── wrong / confused / silent ─────► adapt (new angle) ────┘
```

The brain moves between these stages **by itself**. It can skip stages (a student who is nearly there goes straight to PRACTICE) or loop back (a wrong answer at CHECK goes back to EXPLAIN with a different picture).

### When the brain acts without being asked (proactive)

| Signal | What the brain does |
|---|---|
| Student writes a line the engine says is **wrong** | Gently flags it: highlights the spot, asks "Check the sign here?" Doesn't give the fix. |
| Student **stops writing for a while** mid-problem (~8–10 s, to tune) | Offers a nudge: "Want a hint for the next step?" |
| Student answers a check question **wrongly** | Goes back to EXPLAIN with a new angle. |
| An idea is **visual** (slope, area, a parameter changing a curve) | Draws it without being asked. |
| Student writes a **correct** line | Quiet ✓ on the canvas. No talking, so it doesn't interrupt. |
| [OPEN] Student **circles something and pauses** | Offer help, or wait for them to speak (D16 currently says wait). |

---

## 4. How it adapts

The brain keeps a small **student model** for the session (localStorage is enough for the demo):

```ts
type StudentModel = {
  problemId: string;
  stage: 'understand' | 'diagnose' | 'explain' | 'check' | 'practice' | 'verify' | 'done';
  hintLevel: 1 | 2 | 3;              // nudge → hint → one worked step
  triedAngles: string[];             // e.g. ['algebra', 'graph', 'simpler-example']
  misconceptions: string[];          // e.g. ['drops minus sign when differentiating']
  checksPassed: number;              // check questions answered right
  checksFailed: number;
  lastStudentLine?: string;          // LaTeX
};
```

| Situation | Adaptation |
|---|---|
| Wrong answer once | Same idea, smaller step, raise `hintLevel` |
| Wrong twice on the same idea | **Switch angle**: algebra → graph → simpler numbers → analogy (try an angle not in `triedAngles`) |
| Right answer, fast | Fewer words, go straight to PRACTICE |
| Says "I get it" but fails the check question | Treat as not understood; re-explain from a different angle |
| Same mistake as before | Mention it: "Careful, the minus sign again" (from `misconceptions`) |
| "Just show me" | One worked step in tutor ink, then "Your turn for the next line" |

---

## 5. Talking while drawing: the "beat" idea

The brain doesn't send one long answer. It sends a list of **beats**. Each beat is **one spoken sentence plus the visuals that happen while it's said**. The player (on the app side) speaks the sentence and fires its visuals **at the same moment**, so the drawing matches the words.

**Example: "why do we pick u = x?"**

| Beat | Says | On the canvas, at the same time |
|---|---|---|
| 1 | "Look at the two parts: x and eˣ." | Highlight `x` in blue, `eˣ` in green |
| 2 | "Watch what happens when we differentiate x." | Write `x → 1` in tutor ink |
| 3 | "It becomes just 1, so it gets simpler." | Circle the `1` |
| 4 | "But eˣ stays eˣ forever." | Write `eˣ → eˣ` |
| 5 | "So which one should be u, the one that gets simpler or the one that doesn't?" | (question, wait for answer) |

**Changing values live** works the same way. A beat can say "as *a* grows, the curve gets steeper" while the graph's *a* slides from 1 to 3.

The brain ends each turn by saying what it's waiting for: an **answer** (voice), a **line** (pen), or **nothing** (done).

---

## 6. The brain's tools

The brain is Gemini Flash with **tool calling**. These are its hands:

| Tool | What it does | Built by |
|---|---|---|
| `readInk(region?)` | Returns the student's handwriting as LaTeX | Part A |
| `getCircle()` | Returns the latest circled area (crop, PDF text, nearby lines) | Part A |
| `checkStep(prev, next)` | Math engine: is `next` a valid step from `prev`? | Part D |
| `checkAnswer(problem, answer)` | Math engine: is the final answer correct? | Part D |
| `say(text)` | Speak one sentence (one beat) | Part C |
| `highlight(target, colour)` | Highlight a term or region on the page | Part A |
| `writeStep(latex)` | Write one line in tutor ink, animated as if handwritten | Part A |
| `mark(target, 'tick' \| 'cross' \| 'circle')` | Tick, gentle cross, or circle on the canvas | Part A |
| `plot({ fn, xRange, params? })` | Draw a graph next to the problem | Part D |
| `animateParam({ plotId, param, from, to, ms })` | Slide a value while talking | Part D |
| `showVisual(kind, args)` | Ready-made visuals: tangent line, area under curve, number line, table of values | Part D |
| `ask(question, expect)` | Ask a question and wait (`expect`: `'voice'` or `'line'`) | Part B + C |
| `updateModel(patch)` | Update the student model (stage, hint level, misconception) | Part B |

Visuals are **for teaching only**. They show the idea, never the final answer.

---

## 7. Data contracts (agree on these first; everyone codes against them)

```ts
// brain → player (one teaching turn)
type TutorTurn = {
  beats: Beat[];
  waitFor: 'answer' | 'line' | 'none';  // what happens after the last beat
  question?: string;                     // when waitFor = 'answer'
};

type Beat = {
  say: string;                // one sentence, streamed to TTS
  visuals: VisualAction[];    // fired when this sentence starts playing
};

type VisualAction =
  | { type: 'highlight'; target: Target; colour: 'blue' | 'green' | 'red' }
  | { type: 'writeStep'; latex: string; near: Target }
  | { type: 'mark'; target: Target; kind: 'tick' | 'cross' | 'circle' }
  | { type: 'plot'; id: string; fn: string; xRange: [number, number]; params?: Record<string, number>; near: Target }
  | { type: 'animateParam'; plotId: string; param: string; from: number; to: number; ms: number }
  | { type: 'showVisual'; kind: 'tangent' | 'area' | 'numberLine' | 'table'; args: Record<string, unknown>; near: Target };

type Target = { bbox: { x: number; y: number; w: number; h: number } } | { shapeId: string };

// canvas → brain
type CanvasEvent =
  | { type: 'circle'; context: CircleContext }   // see APPROACH_DRAFT §9
  | { type: 'line'; latex: string; bbox: Target }
  | { type: 'idle'; ms: number };

// voice → brain
type StudentSaid = { transcript: string; duringTurn: boolean };
```

**Streaming:** the brain streams beats one by one, so the first sentence plays in about 1–2 s and the rest arrive while it talks.

---

## 8. The four parts (who builds what)

Each part has **one owner** and its **own folder**, so we rarely touch the same files. Parts talk to each other only through the contracts in §7. Each part's folder has a `README.md` guide with its files, tasks and how to test alone.

### Part A: Canvas eyes and hands
*The brain's eyes on the page and its pen.*
- Watch strokes: detect **circles** vs **writing** (D16); group writing into lines
- `getCircle`: crop image + PDF text + nearby lines
- `readInk`: handwriting → LaTeX (Gemini vision on the ink crop)
- Send `CanvasEvent`s: new circle, new line, idle time
- Tutor ink on the canvas: `highlight`, `writeStep` (stroke animation, Caveat/Kalam), `mark`
- Placing visuals next to the problem without covering the student's work
- Folder: `src/components/app/`, `src/lib/canvas/`

### Part B: The Agent Brain (core; the lead)
*Decides what to do next.*
- The teaching loop (§3) and its stages
- System prompt + rules (§2); hint ladder; check questions; "explain it back" judging
- Gemini tool calling + streaming beats out as `TutorTurn`s
- Student model + adaptation (§4); proactive triggers (§3 table)
- Fallback to Flash-Lite on 429/5xx; "trust the engine" when Gemini and the engine disagree
- A **test bench**: a page that feeds fake canvas/voice events, to tune the brain without a tablet
- Folder: `src/lib/agent/`, `src/app/api/tutor/`

### Part C: Voice and the player
*Makes it a conversation, and keeps speech and drawing in sync.*
- Mic on/off button (D15), Gradium STT streaming, end-of-turn detection
- Gradium TTS, sentence by sentence; instant "Mm, let me look…" acknowledgement
- **The beat player**: speak each beat and fire its visuals at the same moment; queue; pause/resume
- Barge-in: student talks → stop speaking, clear the queue, send `StudentSaid` to the brain
- Listening for answers after `ask` ("did you get it?" → yes/no/explanation)
- Token API route (key stays on the server)
- Folder: `src/lib/voice/`, `src/lib/player/`, `src/app/api/voice/`

### Part D: Math engine and visuals
*Keeps the brain honest and gives it pictures.*
- `checkStep` / `checkAnswer`: LaTeX → expression, compare at random points; integrals by differentiating
- Graph component: `plot` + `animateParam` (smooth value changes while talking)
- Ready-made visuals: tangent line, area under a curve, number line, table of values
- KaTeX rendering for any typed math
- **Demo**: pick the 2–3 demo problems, write the demo script, record the backup video
- Folder: `src/lib/math/`, `src/components/visuals/`

### How the parts connect

```
   Part A (canvas)           Part B (brain)            Part C (voice + player)
 ┌───────────────┐  events  ┌──────────────┐  turns   ┌────────────────────┐
 │ circles, lines│ ───────► │ teaching loop│ ───────► │ speak beat + fire  │
 │ idle, readInk │          │ student model│          │ visuals in sync    │
 │ tutor ink     │ ◄─────── │ tool calls   │ ◄─────── │ mic, STT, barge-in │
 └───────────────┘  draw    └──────┬───────┘  answers └─────────┬──────────┘
                                   │ checkStep / plot           │ visuals
                                   ▼                            ▼
                            ┌──────────────────────────────────────┐
                            │ Part D: math engine + graphs/visuals │
                            └──────────────────────────────────────┘
```

---

## 9. Build order (so nobody waits on anyone)

| Step | Everyone | Notes |
|---|---|---|
| 1 | ✅ §7 contracts are in `src/lib/contracts.ts`, fakes in `src/lib/fakes.ts`, wiring in `src/lib/session.ts` | 30 min, together. Changing it later needs a quick team OK |
| 2 | Each part builds against **fakes** | B uses fake events + prints turns as text; C plays a hard-coded `TutorTurn`; A logs events to the console; D tests with a fixed list of steps |
| 3 | **First join: B + C** | The brain talks: real Gemini → beats → spoken out loud |
| 4 | **Second join: + A** | The brain sees circles/lines and draws on the canvas |
| 5 | **Third join: + D** | Real checking and live graphs |
| 6 | Run the demo problems end to end, tune prompts and timings | B leads, everyone tests on the tablet |

---

## 10. What "done" looks like for the demo

A student circles `∫x·eˣ dx` and asks "how do I start this?". ∂raft:
1. Asks what they think first, and listens.
2. Explains with highlights while talking (beats).
3. Asks "Did you get it?", then a check question. The student gets it wrong, so it re-explains with a different picture.
4. The student writes the next line, and the engine checks it: ✓.
5. The student makes a sign mistake. ∂raft **notices on its own**, highlights it, and asks a question. No answer is given.
6. The student finishes, and ∂raft asks them to explain why `u = x`. They do. Done.

Bonus visual demo: "why is the derivative of x² equal to 2x?" → tangent line sliding along the curve while the slope value changes and ∂raft talks.

---

## 11. Open questions

- [ ] Graph library: **function-plot** (planned) vs **Mafs** (React, made for animated math). Lean Mafs for `animateParam`
- [ ] How the brain judges "explain it back" (Gemini rubric? keywords?)
- [ ] Idle-time threshold before a proactive nudge (8 s? 10 s?)
- [ ] Circle + pause: offer help on its own, or wait for the student to speak?
- [ ] One Gemini call per turn (all beats) vs one call per beat (more adaptive, more requests)
- [ ] How many beats per turn before the brain must ask something (proposal: max 4)
