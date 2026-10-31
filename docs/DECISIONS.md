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
| D2 | **Tutor, not auto-solver**: hint ladder (nudge → hint → one worked step) | 🟡 | Our pitch says others give answers, not understanding. Full auto-complete would undercut it |
| D1 | No handwriting cloning; use a handwriting-style font + stroke animation | ✅ | Not feasible in 24 h (also on our slides) |

---

## Open questions

| # | Question | Notes |
|---|---|---|
| Q1 | Final architecture/approach | The lead to finalise; see [APPROACH_DRAFT.md](APPROACH_DRAFT.md) |
| Q2 | Primary voice: Gradium pipeline or Gemini Live API? | Measure Gradium full-loop latency first |
| Q3 | Hidden "full solve" feature: yes/no? | Must not be the headline |
| Q4 | Graph tool in the demo or nice-to-have? | |
| Q10 | With the mic on, keep the Groq gate to skip thinking aloud, or rules-only filter? | Mic button (D15) handles most cases |
| Q11 | Auto-turn-off the mic after a long silence? | e.g. 60 s; protects credits and privacy |
| Q12 | Circle-detection thresholds | Tune on the tablet with real strokes |
| Q5 | Billing on the Gemini demo project? | Higher limits, ~$1–2; needs a budget alert |
| Q6 | Tutor voice | Choose in Gradium Studio |
| Q7 | Final owner per area | Proposed: Canvas / Agent / Voice / Math+Demo |
| Q8 | What does the hackathon allow as prior work? | Affects whether we scaffold the repo early |
| Q9 | Is any teammate on Google AI Pro (≈$10/month Cloud credits)? | Could pay for the demo project |

---

## Security incidents

| Date | What | Action |
|---|---|---|
| 2026-10-31 | Groq key `gsk_512c…` was shared in an AI chat (editor selection) | Key deleted in the Groq console, new key created ✅ |
