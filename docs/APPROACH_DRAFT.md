# Approach (DRAFT, not final)

> ⚠️ This is the **current proposal**, not the final design. The lead will finalise it, and the team should update this file as decisions are made.
> Anything marked **[OPEN]** is undecided. Decisions go in [DECISIONS.md](DECISIONS.md).

---

> **Core feature: the Agent Brain.** The tutor's brain is our main work: hints and single steps (never the full solution), talking while it draws, asking "did you get it?" and adapting, acting on its own, and staying in the loop until the student can do it. Full spec and the 4-part work split: **[AGENT_BRAIN.md](AGENT_BRAIN.md)** (D19 to D23).

## 1. Product scope

### Must have (the demo)
1. **The Agent Brain** teaching loop: understand → diagnose → explain → check → practice → verify, until solved or explained back ([AGENT_BRAIN.md](AGENT_BRAIN.md))
2. **Talk while drawing**: spoken "beats" in sync with highlights, tutor-written steps, **graphs and live value changes** (D21)
3. **Proactive**: flags wrong lines, nudges after a long pause, draws visuals without being asked (D22)
4. PDF shown on a locked layer, with the pen on top. **No circle button**: circles and writing are detected automatically (see §3a)
5. Circle → crop + PDF text extraction → brain explains
6. Streaming voice in and out, controlled by **one mic on/off button**, with **interruption** (barge-in)
7. **Hint ladder** (nudge → hint → worked step) + math-engine step check + green ✓

### Nice to have
- Extra ready-made visuals beyond graphs (number line, table of values)
- Memory across problems ("the minus sign again")
- Animated "handwriting" font for tutor-written steps

### Cut / not now
- `.docx` upload (needs LibreOffice, won't run on Vercel). **Accept PDF + images only**
- Cloning the student's exact handwriting
- Full auto-complete of solutions (contradicts our "understanding, not answers" pitch)
- Paper mode, Indian languages, teacher view (these are "next 30 days")

---

## 2. Explain vs. auto-complete

**Proposal:** build the **tutor**, not an auto-solver.

| Level | Behaviour | Trigger |
|---|---|---|
| 1 Nudge | Guiding question | Default |
| 2 Hint | States the rule/idea, not the result | Wrong attempt / "still don't get it" |
| 3 Worked step | Writes **only the next line** on canvas in tutor ink | Explicit "show me" or two failed tries |

After each level: "Your turn," then the student writes, and the engine checks.
A full solve may exist as a hidden power feature, **never** the headline. **[OPEN]** whether to include it at all.

---

## 3. Canvas: separating the document from the writing

- **Bottom layer (locked):** pdf.js renders each page to an image → placed as a **locked image shape** in tldraw, pages stacked vertically.
- **Top layer:** all ink as normal tldraw shapes, tagged:
  ```ts
  meta: { author: 'student' | 'tutor', kind: 'ink' | 'circle' | 'graph' | 'step' }
  ```
  Tutor ink in a distinct colour, plus a "hide tutor ink" toggle.

**When the student circles:**
1. Get the circle's bounding box (page coordinates).
2. Build 3 inputs for Gemini:
   - **Printed text** in the box via pdf.js `getTextContent()` (exact, free, instant)
   - **Ink-only image** (export only `author: 'student'` shapes in the box)
   - **Combined crop** (PDF + ink) for context

---

## 3a. How the student gives input (decided, see D15 and D16)

There is exactly **one control**: the **mic button**. Everything else happens by just using the pen.

### Talking: mic on/off button
- The student **taps the mic button to start talking** to the tutor, and **taps it again to stop** it listening.
- **Mic on:** the app listens, streams speech to STT, and treats what's said as meant for the tutor. A clear "● Listening" state is shown.
- **Mic off:** **no audio is captured or sent.** The tutor never hears background talk, self-talk or other people. This also saves Gradium credits and avoids false triggers in noisy rooms.
- The tutor's spoken reply plays whether the mic is on or off.
- **Barge-in:** if the mic is on and the student starts speaking while the tutor is talking, the tutor stops and listens.
- [OPEN] Should the mic turn itself off after a long silence (e.g. 60 s), to protect credits and privacy?

### Writing and circling: no button, detected automatically
- The pen is always just a pen. The app watches the strokes and decides what each one is:
  - **Circle:** a closed (or nearly closed) loop whose area surrounds existing content (PDF text or ink). → Treat as "this is the part I'm asking about": crop it and attach it to the next question. The stroke is tagged `kind: 'circle'`.
  - **Writing:** everything else → normal ink (`kind: 'ink'`), used for reading the student's lines and checking steps.
- Detection idea (to tune on the tablet): stroke start and end points within ~15% of the stroke's size, the path mostly encloses a region, and that region overlaps text or ink. Big loops around a whole problem and small loops around one term both count.
- If a loop is ambiguous, keep it as ink and, when the student asks, say "this step, or the whole problem?"
- A circle by itself **does not** make the tutor speak. It marks the context. The tutor responds when the student asks with the mic on (or, if we keep it, after the 3 s writing pause).

---

## 4. The agent loop

> **Superseded in detail by [AGENT_BRAIN.md](AGENT_BRAIN.md)** (teaching stages, beats, tools, student model). The sketch below is the original outline.

```
trigger (question while mic is on | 3 s writing pause)
  context: latest auto-detected circle + recent lines
  → light filter: skip fillers ("hmm", "okay")   (see §6)
  → planner (Gemini Flash, tool-calling, streaming)
       tools: readInk, checkStep, plot, setHintLevel, writeStep, mark
  → speak (stream sentences to TTS) + act on canvas
  → wait for the student's next line → checkStep → loop
  → stop when the engine confirms correct, or the student says "got it"
```

- **Orchestration:** Vercel AI SDK (`ai` + `@ai-sdk/google`) for streaming + tool calls.
- **Memory (demo):** IndexedDB/localStorage: hint level per problem, mistake log, last checked line. No database.
- **Model fallback:** Gemini Flash → Gemini Flash-Lite on 429/5xx.

---

## 5. Voice: making it feel instant

Target: **< 3 s** from end of question to first spoken word (ideally much less).

1. **Mic button on** → open the Gradium STT WebSocket (with a fresh token). **Mic off** → close it and stop capturing audio.
2. **Local VAD** (`@ricky0123/vad-web`, Silero) in the browser while the mic is on: only send audio while someone is actually speaking. This saves Gradium credits.
3. **Gradium STT over WebSocket**, with `delay_in_frames` around **8–16**. The default we saw was 50 = **4 s lag**. See [TEST_RESULTS.md](TEST_RESULTS.md).
4. **End of turn:** Gradium's semantic VAD. The last `vad` horizon's `inactivity_prob` stays above about 0.5–0.7 for a few steps. Tune on the tablet.
5. **Light filter** (instant, rules only): ignore fillers. See §6.
6. **Instant acknowledgement** (~300 ms): play "Mm, let me look…" while Gemini works.
7. **Stream Gemini → Gradium TTS sentence by sentence.**
8. **Barge-in:** if the mic is on and the student speaks while TTS plays, stop audio immediately and listen.

**Browser auth:** Next.js API route mints a **single-use Gradium token** (`GET /api/api-keys/token`) per WebSocket. The key never reaches the browser. This avoids Vercel's no-WebSocket limitation.

**Backup voice path [OPEN]:** Gemini Live API (full-duplex, free tier) if the Gradium pipeline is too slow.

---

## 6. "Is this for me?" gate

> **Changed by D15:** the mic button now tells the app the student is talking to it, so the gate is **no longer the main filter**. With the mic on, speech is assumed to be for the tutor.
> What stays: a **rules-only filter** for fillers ("hmm", "okay", "wait"). [OPEN] Whether to keep the Groq check as an extra layer for thinking aloud while the mic is on (e.g. "okay so u equals x"). The tested prompt and results are kept in [prompts/gate-prompt.md](prompts/gate-prompt.md) in case we need it.

Original plan (kept for reference). Order:
1. **Rules (no API call):**
   - Obvious yes: starts with "draft", or circled within ~10 s and question-shaped
   - Obvious no: fillers ("hmm", "okay"), or matches PDF text being read aloud
2. **Groq** `qwen/qwen3.8-27b`, `reasoning_effort: "none"`, JSON mode, using [prompts/gate-prompt.md](prompts/gate-prompt.md)
3. **Fallback:** Gemini Flash-Lite with the same prompt

Use only `for_me`. **Ignore `confidence`** (always ~0.95, not meaningful). Borderline cases → small "Did you ask me?" bubble instead of speaking.

---

## 7. Math checking

- Gemini outputs each step as **LaTeX + a plain expression** (or parse LaTeX with `@cortex-js/compute-engine`).
- **Algebra steps:** compare line N and line N+1 numerically at 5–10 random points.
- **Integrals:** differentiate the student's answer (nerdamer) and compare to the integrand at random points.
- If Gemini and the engine disagree → trust the engine, retry once, then "I'm not sure".

---

## 8. Graphs and tutor writing

- Gemini tool: `plot({ fn, xRange, highlight })` → function-plot SVG placed next to the circled area as a tutor shape. Use only when helpful.
- Tutor steps: KaTeX / a handwriting-style font (**Kalam** or **Caveat**) with **SVG stroke-dash animation** so it looks written.

---

## 9. Data contracts between parts (agree before building)

```ts
// canvas → agent
type CircleContext = {
  cropImage: string;      // PNG data URL, PDF + ink
  inkOnlyImage: string;   // PNG data URL, student ink only
  pdfText: string;        // printed text inside bbox
  bbox: { x: number; y: number; w: number; h: number };
  pageNo: number;
  recentLines: string[];  // last few recognised lines (LaTeX)
};

// voice → agent
type Utterance = {
  transcript: string;
  isForMe: boolean;
  msSinceCircle: number | null;
};

// agent → canvas / voice
// Replaced by TutorTurn / Beat / VisualAction in AGENT_BRAIN.md §7. Kept for reference.
type TutorAction = {
  say: string;
  hintLevel: 1 | 2 | 3;
  writeStep?: string;                       // LaTeX
  plot?: { fn: string; xRange: [number, number] };
  mark?: 'tick' | 'cross' | 'highlight';
};
```

---

## 10. Environment config (code side)

One switch picks all keys. Names follow `SERVICE_KEY_ENV`:

```ts
// lib/keys.ts
const env = process.env.APP_ENV === 'demo' ? 'DEMO' : 'DEV';
const need = (service: string) => {
  const name = `${service}_KEY_${env}`;
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};

export const keys = {
  gemini:  need('GEMINI'),
  gradium: need('GRADIUM'),
  groq:    need('GROQ'),
};
```

---

## 11. Hosting

- **Vercel Hobby** for the submitted link (`APP_ENV=demo` in Vercel env vars).
- **Demo-day fallback:** run locally on a laptop behind a **Cloudflare Tunnel** (HTTPS is needed for mic access on iPad).

---

## 12. Open questions

- [x] ~~Final scope cut: is the graph tool in the demo?~~ Yes, must-have (D21)
- [ ] Agent Brain questions: see [AGENT_BRAIN.md §11](AGENT_BRAIN.md)
- [ ] Gradium WebSocket pipeline vs. Gemini Live API as primary voice
- [ ] Jev vs. Groq for the gate (currently Groq). Now lower priority: the mic button replaces most of the gate's job
- [ ] Keep the Groq gate while the mic is on (to skip thinking aloud), or rules only?
- [ ] Auto-turn-off the mic after a long silence? How long?
- [ ] Circle detection thresholds (closure, enclosed area, overlap with content), to tune on the tablet
- [ ] Include a hidden "full solve" or not
- [ ] Best `delay_in_frames` value (8 / 12 / 16), to test on the tablet
- [ ] Tutor voice ID (choose in Gradium Studio)
- [ ] Assign owners for Parts A, C, D (the lead owns B; see D23)
- [ ] Check the hackathon's rules on prior work (what can be built in advance)
