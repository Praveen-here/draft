# Test Results

Everything we've tested so far, with dates and what we learned.

---

## 31 Oct 2026: Math engine (Part D)

`npx jiti src/lib/math/check.test.ts`: **71/71 pass**, each check 0–50 ms (most under 5 ms).

| Covered | Result |
|---|---|
| ∫x eˣ dx chain (by parts → answer), LaTeX and unicode | ✅ ok |
| The sign mistake `x eˣ + ∫eˣ dx` | ✅ flagged, with where the values differ |
| Practice sheet Q8–Q11 planted mistakes (2(x+3) → 2x+3, missing chain-rule ×3, missing + C, (x+4)² = x² + 16) | ✅ all 4 flagged |
| Q5, Q6, Q7 answers; Q3 as `\int_0^2 x^2 dx` | ✅ |
| Right but different-looking forms (sin²x + cos²x = 1, ln x² = 2 ln x, −cos²x/2 vs sin²x/2 + C, x/(x+1) = 2 → x = 2(x+1)) | ✅ no false alarms |
| Side notes (`u = x`, `du = dx`), word problems, unknown LaTeX | ✅ `unsure` / `unparseable` (tutor stays quiet) |

Not covered yet: handwriting → LaTeX accuracy (Part A), matrices, inequalities, limits, `±` inside a step.

---

## 31 Oct 2026: Brain v1 end to end

Headless Edge: open a worksheet PDF → circle a line → type a question → watch the tutor.

| Test | Result |
|---|---|
| Circle around a line of text detected (long flat loop) | ✅ after allowing wide loops (first try rejected 14:1 loops) |
| "What does a do?" on `y = a x²` | ✅ draws the graph beside the page, slides a 1 → 3 while talking, asks a question |
| Wrong answer ("it gets wider") | ✅ marked "Your answer", re-explains on the **same** graph with numbers |
| "How do I start?" on `∫ x eˣ dx` | ✅ highlights `x eˣ`, names the two kinds of function, asks which method; no answer given |
| Reply time per turn (Flash-Lite) | ~2–4.5 s |
| Console errors | none |

Model availability (31 Oct): `gemini-3.8-flash`, `3.7-flash`, `flash-latest` often **503 busy**; `3.5-flash` 8–45 s; `3.5-flash-lite` ~2 s.

---

## 31 Oct 2026: Gemini keys

- `draft-dev` and `draft-demo` projects created in AI Studio; keys tested.
- ⬜ Still to record: real rate limits per model (AI Studio → Rate Limit) and the exact model names.

---

## 31 Oct 2026: Gradium (free plan)

**Result:** API access **works on the free plan**. TTS and STT both work.

**Round trip test:** TTS said *"Good question! The minus comes from the integration by parts rule."* → STT returned *"Good question. The minus comes from the integration by parts rule."* ✅ Exact.

**What the STT stream sends:**

| Message | Meaning |
|---|---|
| `ready` | Settings (model, sample rate 24 kHz, frame 80 ms, `delay_in_frames`) |
| `step` | Every 80 ms, with `vad[]` horizons (0.5/1/2/3 s) of `inactivity_prob` = chance the speaker has stopped |
| `text` | A word/phrase with `start_s` |
| `end_text` | Phrase finalised (`stop_s`) |
| `end_of_stream` | Done |

**⚠️ Finding: 4-second transcript lag by default**
- `ready` reported `delay_in_frames: 50` → 50 × 80 ms = **4 s**.
- Confirmed: "Good" (spoken at 0.0 s) arrived only at step 54 (4.32 s).
- Docs: range 0–80; recommend **16** balanced, **8** for responsiveness.
- **Action:** always send `delay_in_frames` (try 12) in `json_config`. ⬜ Re-test and record the new lag + accuracy.

**End-of-turn detection:** use the **last** `vad` horizon; when `inactivity_prob` stays above ~0.5–0.7 for a few steps, the student has finished. Tune on the tablet.

⬜ Still to test: own voice (Indian English accent), background noise, Hinglish, keyword boosting effect, WebSocket streaming from iPad Safari, browser token flow.

---

## 31 Oct 2026: "Is this for me?" gate on Groq

### Run 1: short prompt, 10 sentences

| Model | Score | Typical latency |
|---|---|---|
| `openai/gpt-oss-20b` (`reasoning_effort: low`) | 8/10 | ~650 ms |
| `qwen/qwen3.8-27b` (`reasoning_effort: none`) | 8/10 | **~240 ms** |

Both missed:
- "okay so u equals x" (thinking aloud)
- "find the integral of x e to the x dx" (reading the question aloud)

### Run 2: improved prompt ([prompts/gate-prompt.md](prompts/gate-prompt.md)), `qwen/qwen3.8-27b`, 14 sentences

**Score 14/14 · median 266 ms** (range 207–510 ms; the first call is slowest)

| Result | Latency | for_me | Sentence |
|---|---|---|---|
| OK | 510 | true | why is there a minus here |
| OK | 269 | true | can you explain this step |
| OK | 243 | true | I don't get where the e to the x came from |
| OK | 241 | true | draft what is integration by parts |
| OK | 237 | true | is this right |
| OK | 287 | false | okay so u equals x |
| OK | 266 | false | mom I'll eat in ten minutes |
| OK | 243 | false | find the integral of x e to the x dx |
| OK | 406 | false | hmm |
| OK | 282 | false | ugh I hate this chapter |
| OK | 288 | true | wait how do I choose u |
| OK | 248 | false | so v is e to the x and du is dx *(circled 4 s ago)* |
| OK | 259 | true | what comes next |
| OK | 207 | false | question five evaluate the limit as x tends to zero |

**Learnings**
- The prompt matters more than the model: explicit "NOT for the tutor" examples fixed both misses.
- `confidence` is always 0.95–1.0 → **useless; use only `for_me`.**
- Turning reasoning off (`reasoning_effort: "none"`) is what makes Qwen fast.
- `llama-3.1-8b-instant` no longer exists on Groq.

⬜ Next: build a 40–50 sentence set from **real recordings** (incl. Hinglish, noisy transcripts, partial sentences) and re-run.

---

## Measurements to collect before the event

| Measurement | Target | Result |
|---|---|---|
| Gradium STT lag with `delay_in_frames` 12 | < 1 s | ⬜ |
| Gradium TTS time to first audio | < 300 ms | ⬜ |
| Gate (Groq) | < 400 ms | ✅ ~266 ms |
| Gemini Flash: circled image → first token | < 1.5 s | ⬜ |
| Gemini ink reading accuracy on our handwriting | ≥ 4/5 samples | ⬜ |
| Full loop: end of question → first spoken word | < 3 s | ⬜ |
| VAD + mic in iPad Safari | works | ⬜ |
| tldraw + Apple Pencil (palm rejection, zoom) | smooth | ⬜ |
| nerdamer check of ∫x eˣ dx | ✓ | ⬜ |
