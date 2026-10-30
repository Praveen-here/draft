# Approach (DRAFT, not final)

> ⚠️ This is the **current proposal**, not the final design. The lead will finalise it, and the team should update this file as decisions are made.
> Anything marked **[OPEN]** is undecided. Decisions go in [DECISIONS.md](DECISIONS.md).

---

## 1. Product scope

### Must have (the demo)
1. PDF shown on a locked layer, with pen and **Circle tool** on top
2. Circle → crop + PDF text extraction → Gemini explains
3. Streaming voice in and out, with **interruption** (barge-in) and a **push-to-talk** fallback
4. **Hint ladder** (nudge → hint → worked step) + math-engine step check + green ✓

### Nice to have
- Graph tool (function-plot)
- Auto-trigger after a 3-second writing pause
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

**Circle detection:** an explicit **Circle tool** (lasso) + auto-detect of closed loops around content. If ambiguous, ask "this step or the whole problem?"

---

## 4. The agent loop

```
trigger (circle | voice question | 3 s pause)
  → gate: is this for me?            (rules → Groq → Flash-Lite fallback)
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

1. **Local VAD** (`@ricky0123/vad-web`, Silero) in the browser: only send audio while someone is speaking. This saves Gradium credits.
2. **Gradium STT over WebSocket**, with `delay_in_frames` around **8–16**. The default we saw was 50 = **4 s lag**. See [TEST_RESULTS.md](TEST_RESULTS.md).
3. **End of turn:** Gradium's semantic VAD. The last `vad` horizon's `inactivity_prob` stays above about 0.5–0.7 for a few steps. Tune on the tablet.
4. **Gate** (~270 ms on Groq).
5. **Instant acknowledgement** (~300 ms): play "Mm, let me look…" while Gemini works.
6. **Stream Gemini → Gradium TTS sentence by sentence.**
7. **Barge-in:** if the mic detects speech while TTS plays, stop audio immediately and listen.
8. **Push-to-talk button** always available (noisy halls).

**Browser auth:** Next.js API route mints a **single-use Gradium token** (`GET /api/api-keys/token`) per WebSocket. The key never reaches the browser. This avoids Vercel's no-WebSocket limitation.

**Backup voice path [OPEN]:** Gemini Live API (full-duplex, free tier) if the Gradium pipeline is too slow.

---

## 6. "Is this for me?" gate

Order:
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

- [ ] Final scope cut: is the graph tool in the demo?
- [ ] Gradium WebSocket pipeline vs. Gemini Live API as primary voice
- [ ] Jev vs. Groq for the gate (currently Groq)
- [ ] Include a hidden "full solve" or not
- [ ] Best `delay_in_frames` value (8 / 12 / 16), to test on the tablet
- [ ] Tutor voice ID (choose in Gradium Studio)
- [ ] Final owner per area
- [ ] Check the hackathon's rules on prior work (what can be built in advance)
