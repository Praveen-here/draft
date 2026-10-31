# Pre-Hackathon Checklist

Goal: arrive with everything around the code ready, so we start building features in hour 1.

> ⚠️ **First, read the hackathon rules on prior work.** Usually allowed: accounts, keys, research, designs, throwaway test scripts. Often **not** allowed: project code written beforehand (judges may check git history). Start the real repo at the event unless the rules say otherwise.

---

## 1. Accounts and keys

- [x] Gemini: `draft-dev` + `draft-demo` projects and keys (lead)
- [x] Gradium: dev account + key works on the free plan (lead)
- [x] Groq: dev + demo keys (lead); old exposed key deleted
- [ ] Rename `GROQ_DEV_KEY` → `GROQ_KEY_DEV` in the lead's `.env.local`
- [ ] Gradium **demo** account (team email) + `GRADIUM_KEY_DEMO`
- [ ] Groq demo key in a **separate account** (own quota)
- [ ] Each teammate: own Gemini / Gradium / Groq dev accounts ([SETUP_GUIDE.md](SETUP_GUIDE.md))
- [ ] Shared team email + Bitwarden organisation; all keys stored with clear labels
- [ ] Vercel account linked to GitHub
- [ ] **tldraw license key** (tldraw.dev) → `NEXT_PUBLIC_TLDRAW_LICENSE_KEY` in Vercel. Without it the canvas disappears on any HTTPS deploy
- [ ] GitHub org/repo created (empty), all 4 added
- [ ] Record real rate limits (Gemini, Groq) in [SERVICES_AND_KEYS.md](SERVICES_AND_KEYS.md)
- [ ] Decide: billing on the Gemini demo project? (If yes, set a budget alert first)
- [ ] Decide: Jev yes/no (currently no)

## 2. Prove each piece works (throwaway scripts)

- [ ] Gemini vision: 5 photos of our handwritten math → LaTeX. Accuracy + time
- [ ] Gemini tool calling + streaming with the Vercel AI SDK (e.g. `plot` tool)
- [ ] Gradium STT with `delay_in_frames` 8 / 12 / 16. Lag + accuracy
- [ ] Gradium on **our own voices** + background noise (+ Hinglish)
- [ ] Gradium **WebSocket from iPad Safari** with a browser token
- [ ] Gradium TTS: choose the tutor voice; note its ID
- [x] Groq gate: 14/14, ~266 ms
- [ ] Gate: 40–50 real sentence set (lower priority now that the mic button exists, see D15)
- [ ] Circle detection: collect real circle vs. writing strokes from all 4 of us on the tablet
- [ ] Gemini Live API: one test as backup voice
- [ ] Silero VAD (`@ricky0123/vad-web`) in **iPad Safari**
- [ ] tldraw + Apple Pencil: smoothness, palm rejection, pinch-zoom vs pen
- [ ] pdf.js: render page + text-with-positions from a real worksheet
- [ ] nerdamer: verify ∫x eˣ dx = x eˣ − eˣ + C by differentiating

Record all numbers in [TEST_RESULTS.md](TEST_RESULTS.md).

## 3. Hardware and venue kit

- [ ] Tablet(s) + stylus, fully charged, chargers
- [ ] **Headset with mic** (mic + speaker in a loud hall = echo and noise problems)
- [ ] Mobile hotspot with data (venue Wi-Fi may block WebSockets)
- [ ] Backup laptop that runs everything locally
- [ ] Extension board, cables, screen-mirroring/HDMI adapter
- [ ] iPad Safari mic permission tested over **HTTPS** (Cloudflare Tunnel)

## 4. Content (not code)

- [ ] 3–5 demo PDFs from our Engineering Maths syllabus, including **Q4 ∫ x eˣ dx**
- [ ] Handwriting samples from all 4 of us (exported images)
- [ ] Gate sentence set (40–50 labelled lines)
- [ ] Draft prompts: planner system prompt, hint-ladder rules, tutor tone, JSON output formats
- [ ] Demo script, second by second
- [ ] **Backup demo video** recording
- [ ] Update slides 1, 3, 4, 5 (Jev → Groq) + add measured numbers

## 5. Team agreements

- [ ] Final owners per area (Canvas / Agent / Voice / Math+Demo)
- [ ] Shared data formats agreed (see [APPROACH_DRAFT.md §9](APPROACH_DRAFT.md#9-data-contracts-between-parts-agree-before-building))
- [ ] Timeline for the 24 h (e.g. hour 0–2 scaffold, hour 6 rough end-to-end)

## 6. Every laptop

- [ ] Node 20+ LTS, Git, VS Code
- [ ] GitHub + Vercel CLI (`npm i -g vercel`) logged in
- [ ] `cloudflared` installed
- [ ] `.env.local` filled from `.env.example`
- [ ] Safari Web Inspector / remote debugging for the tablet

## 7. Two days before

- [ ] Every key works from a phone hotspot
- [ ] All measurements recorded
- [ ] Mic + VAD + tldraw tested on the **actual tablet**
- [ ] Shared folder: PDFs, handwriting, sentence set
- [ ] Hardware packed and charged
- [ ] Rules re-read
