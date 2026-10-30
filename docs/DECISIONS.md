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
| D14 | Landing page: white + **ink blue `#2547d0`**, graph-paper canvas style, headline "Circle it. Ask it. Get it.", hero card auto-plays the Ananya ∫x eˣ dx story | ✅ | Chosen by the lead; layout inspired by a reference screenshot, but our own copy and visuals |
| D13 | UI follows the **apple-design** skill (`.claude/skills/apple-design`): press on touch-down, critically damped springs, glass nav, reduced-motion/transparency/contrast support | ✅ | Premium, consistent feel; written down in `CLAUDE.md` so every UI change follows it |
| D12 | Docs live in `docs/`; key names follow `SERVICE_KEY_ENV` + one `APP_ENV` switch | ✅ | Consistent, one-line switch between dev and demo |
| D11 | Gate model: **Groq `qwen/qwen3.8-27b`**, reasoning off, JSON mode, tested prompt | 🟡 | 14/14 correct, ~266 ms, free. `gpt-oss-20b` was as accurate but ~650 ms |
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
