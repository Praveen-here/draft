# Decisions Log

What we decided, why, and what's still open. Newest first. Add a line whenever something changes.

| Status | Meaning |
|---|---|
| ✅ Decided | Agreed; build on it |
| 🟡 Leaning | Current plan, can change |
| ❓ Open | Not decided |

---

## Decisions

### 2026-10-31

| # | Decision | Status | Why |
|---|---|---|---|
| D23 | Work split into **4 parts**: A Canvas eyes and hands, B Agent Brain (lead), C Voice and beat player, D Math engine and visuals (+ demo). Parts talk only through shared contracts in `src/lib/contracts.ts` | ✅ | Each owner has their own folder, so few merge conflicts; the brain can be built and tested with fakes before the others are ready. See [AGENT_BRAIN.md §8](AGENT_BRAIN.md) |
| D22 | The brain is **proactive**: it flags wrong lines, offers a nudge after a long pause, draws visuals and asks questions without being asked | ✅ | A tutor that only answers is a chatbot; acting on its own is what makes it an agent |
| D21 | **Talk while drawing**: the brain sends "beats" (one sentence + the visuals that happen while it's said); graphs and live value changes are **must-have** | ✅ | Explaining with pictures in sync with speech is our main demo moment. Closes Q4 |
| D20 | **Stay in the loop** until the student solves the step (engine-checked) or explains it back. Asks "did you get it?" plus a check question, and adapts to the answer (new angle after two misses) | ✅ | Understanding, not answers; "yes" alone isn't proof |
| D19 | The **Agent Brain is our core feature** and gets most of our effort; canvas, voice and graphs serve it. Spec: [AGENT_BRAIN.md](AGENT_BRAIN.md) | ✅ | Decided by the lead |
| D18 | Canvas = **tldraw 5.6 with its UI hidden** and our own Apple-style chrome (floating glass toolbar: select, pen, highlighter, eraser, 4 colours, 3 sizes, undo/redo; top bar: back, title, paper picker, fit). Papers: Blank, Lined, Grid, Dots, drawn under the canvas and moving with pan/zoom. PDFs rendered with pdf.js as **locked page images** (not part of undo) | ✅ | Pen pressure, palm rejection, zoom and undo for free; our own look on top. Needs a tldraw license key for HTTPS production (see SERVICES_AND_KEYS §6) |
| D17 | Landing has a **dummy "Continue with Google"** button → `/app`. `/app` start screen offers **Blank document** (choose paper) or **Open a PDF** (drop or browse; PNG/JPG also work; Word files show "save as PDF first") | ✅ | Real sign-in later; for now the flow just needs to reach the canvas |
| D16 | **No circle button.** The pen is always a pen; the app detects circles automatically (closed loop around existing content) and treats everything else as writing | ✅ | Fewer controls, more natural: the student just draws. A circle marks context but doesn't make the tutor speak on its own |
| D15 | **Mic on/off button** for talking. Tap to start talking to the tutor, tap again to stop it listening. Mic off = no audio captured or sent | ✅ | The student decides when they're talking to the tutor, so no guessing. Also saves Gradium credits and avoids false triggers in noisy rooms. Makes the "is this for me?" gate mostly unnecessary (D9/D11 now lower priority) |
| D14 | Landing page: white + **ink blue `#2547d0`**, graph-paper canvas style, headline "Circle it. Ask it. Get it.", hero card auto-plays the Ananya ∫x eˣ dx story | ✅ | Chosen by the lead; layout inspired by a reference screenshot, but our own copy and visuals |
| D13 | UI follows the **apple-design** skill (`.claude/skills/apple-design`): press on touch-down, critically damped springs, glass nav, reduced-motion/transparency/contrast support | ✅ | Premium, consistent feel; written down in `CLAUDE.md` so every UI change follows it |
| D12 | Docs live in `docs/`; key names follow `SERVICE_KEY_ENV` + one `APP_ENV` switch | ✅ | Consistent, one-line switch between dev and demo |
| D11 | Gate model: **Groq `qwen/qwen3.8-27b`**, reasoning off, JSON mode, tested prompt. *Lower priority since D15* | 🟡 | 14/14 correct, ~266 ms, free. `gpt-oss-20b` was as accurate but ~650 ms |
| D10 | **Jev on hold** (not buying the $5 top-up for now) | 🟡 | Groq matches it on speed and accuracy for free. Revisit if Groq struggles on the full test set, or if TypeSafe is a sponsor |
| D9 | Gate order: rules → Groq → Gemini Flash-Lite | 🟡 | Rules are instant and free; the fallback keeps working if Groq rate-limits |
| D8 | Gradium STT must set `delay_in_frames` ≈ 8–16 | ✅ | Default came back as 50 = 4 s lag |
| D7 | Gradium free plan for all dev; separate demo account | ✅ | Free plan API access confirmed; 45k credits/account |
| D6 | Two environments, **dev** and **demo**, with separate keys/projects/accounts | ✅ | Testing must never use up demo quota |
| D5 | Each teammate uses their **own** accounts for dev | ✅ | Limits are per project/org. One person making many accounts to farm quota may break terms |
| D4 | Keep keys server-side; browser gets short-lived tokens (Gradium token, Gemini ephemeral token) | ✅ | Security; Vercel functions can't hold WebSockets |
| D3 | Accept **PDF + images only** (no .docx) | 🟡 | .docx conversion needs LibreOffice, not available on Vercel |
| D2 | **Tutor, not auto-solver**: hint ladder (nudge → hint → one worked step). *Confirmed by D19/D20* | ✅ | Our pitch says others give answers, not understanding. Full auto-complete would undercut it |
| D1 | No handwriting cloning; use a handwriting-style font + stroke animation | ✅ | Not feasible in 24 h (also on our slides) |

---

## Open questions

| # | Question | Notes |
|---|---|---|
| Q1 | Final architecture/approach | The lead to finalise; see [APPROACH_DRAFT.md](APPROACH_DRAFT.md) |
| Q2 | Primary voice: Gradium pipeline or Gemini Live API? | Measure Gradium full-loop latency first |
| Q3 | Hidden "full solve" feature: yes/no? | Must not be the headline |
| Q4 | ~~Graph tool in the demo or nice-to-have?~~ | **Closed by D21:** must-have |
| Q13 | Graph library: function-plot or Mafs? | Mafs is React and built for animated math; leaning Mafs |
| Q14 | How does the brain judge "explain it back"? | Gemini rubric vs key ideas list |
| Q15 | Circle + pause: offer help on its own, or wait to be asked? | D16 says wait; D22 leans proactive |
| Q16 | One Gemini call per turn or per beat? | Per beat = more adaptive, more requests |
| Q10 | With the mic on, keep the Groq gate to skip thinking aloud, or rules-only filter? | Mic button (D15) handles most cases |
| Q11 | Auto-turn-off the mic after a long silence? | e.g. 60 s; protects credits and privacy |
| Q12 | Circle-detection thresholds | Tune on the tablet with real strokes |
| Q5 | Billing on the Gemini demo project? | Higher limits, ~$1–2; needs a budget alert |
| Q6 | Tutor voice | Choose in Gradium Studio |
| Q7 | Final owner per area | Parts set by D23; the lead owns Part B. Assign A, C, D to teammates |
| Q8 | What does the hackathon allow as prior work? | Affects whether we scaffold the repo early |
| Q9 | Is any teammate on Google AI Pro (≈$10/month Cloud credits)? | Could pay for the demo project |

---

## Security incidents

| Date | What | Action |
|---|---|---|
| 2026-10-31 | Groq key `gsk_512c…` was shared in an AI chat (editor selection) | Key deleted in the Groq console, new key created ✅ |
