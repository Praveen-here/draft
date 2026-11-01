# Decisions Log

What we decided, why, and what's still open. Newest first. Add a line whenever something changes.

| Status | Meaning |
|---|---|
| ✅ Decided | Agreed; build on it |
| 🟡 Leaning | Current plan, can change |
| ❓ Open | Not decided |

---

## Decisions

### 2026-11-01

| # | Decision | Status | Why |
|---|---|---|---|
| D41 | **Real Google sign-in with Better Auth** (replaces D17's dummy button). Users, sessions and linked Google accounts are stored in our Postgres (`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`, made on first use); telemetry off. The server takes the learner from the session (`learnerFor` in `src/lib/server/auth.ts`) for documents, the tutor's memory and `/api/tutor`; the id the browser sends is ignored when signed in, and refused signed out in production (accepted only in development, so local tests run without Google). `/app` asks to sign in (development also offers "Continue without signing in"); the start screen shows the account with Sign out. The first sign-in on a device moves that device's documents and memory into the account (`/api/account/claim`, refused if the device id is an account id) | ✅ | Asked by the lead: work belongs to a person, not a laptop. Better Auth uses our Postgres directly and works unchanged on Supabase later; Auth.js is now looked after by the same team |
| D40 | **Saved documents: Postgres + files in this project folder.** Every new document (blank or uploaded) is saved at once; its file goes to `storage/documents/<id>/original.<ext>` (git-ignored), and the `documents` table keeps title, kind, paper, pages, the canvas (all shapes except the PDF pages, the handwriting already read, the camera) and the chat (each explain card with where its mark was snapped). Saves 1.5 s after a change (chat 0.8 s), on leaving, and best effort on closing; a failed save retries. Reopening re-renders the PDF, puts the shapes back without treating them as new writing (no handwriting re-reads), and replays graphs and marks from the chat. Start screen lists **Recent** documents (open, delete). Owner = this device's learner id (`x-learner-id`) until sign-in. Without a database the app still opens documents, unsaved | ✅ | Asked by the lead: students come back to the same document with the same chat. Postgres was already there; files don't belong in rows; a hosted version later = Supabase (same SQL + storage + sign-in) |
| D39 | **The chat is one fixed panel for the document, not bubbles that follow the circle.** Docked left on wide screens, along the top on narrow ones, draggable (D34), hideable with ✕ ("Show chat" brings it back; it stays mounted, so nothing is lost). Scrolling over the chat scrolls the chat; anywhere else scrolls the canvas; the overlay does no per-frame layout. The "Back to your question" pill is gone. It looks like D33 again: no box, bubbles floating over the page with faded top and bottom edges. A lock on the chat’s pill pins it in place (no drag handle while locked), remembered on the device. Replaces the placement half of D33 | ✅ | Asked by the lead: the floating thread got stuck when circling after a scroll, and fought with canvas scrolling |
| D38 | **One conversation per document, never cleared.** A new circle (anywhere, any page) adds a "New question · …" divider to the same thread, with the greeting and reply pills after it, and the thread moves beside the newest circle; the brain starts a fresh problem (its own context, the engine's working) but nothing on screen is removed: bubbles, graphs (the panel pages through them; a graph link opens its own graph) and term marks stay. Graph and card ids are tagged with the problem number (`q2_p1`) so a new problem never replaces an earlier one's. ✕ only hides the chat (a "Show chat" pill brings it back; a new circle, question or answer does too). Replaces D33's "circling another problem replaces the whole thread" and D35's fresh start after solving | ✅ | Asked by the lead: the chat was wiped when circling something after scrolling; the next step saves open documents with their chat |
| D37 | **The brain acts on the student's working, checked by the math engine** (`src/lib/agent/work.ts`). Each handwritten line near the circled problem is checked against the last line that wasn't wrong (the first against the question, read by `normalizeProblem`): a right step gets a quiet ✓ and no talk; a wrong one (`not-equivalent` only, never `unsure`) gets a red highlight and a Gemini turn that asks, without the fix; the correct final answer (integrals, derivatives, equations) ends the problem as solved without a Gemini call. Typed answers that are math are judged by the engine first; the server never lets Gemini say "solved" when the engine says wrong. After 8 s of no writing, once, when the tutor asked for a line: "Stuck on the next line? Ask me for a hint." | ✅ | The agentic core (D20, D22): the engine, not Gemini, decides right and wrong; a false alarm is worse than staying quiet (D28) |
| D36 | **Learner memory in a local Postgres** (`DATABASE_URL`; tables `learners`, `problems`, created on first use). A learner is a device for now (an id in localStorage, no sign-in). Each turn records the problem's topic and level (new Gemini fields), the highest hint, misconceptions, and whether it was solved (and whether the engine checked it); engine line verdicts are recorded too. Every prompt gets a short summary: level, can do, working on, finds hard, past mistakes, recent problems, and rules for using it (smaller steps on hard topics, name a repeated mistake once, never mention the profile). No database = the tutor works without memory. `DELETE /api/learner?id=` forgets a learner | ✅ | Asked by the lead: teach each student from what they know; a summary is cheaper and steadier than replaying old chats |
| D26b | Model chain after 3.5 Flash-Lite is now **3.1 Flash-Lite → 3.8 Flash → 3.5 Flash-Lite** | ✅ | 1 Nov: 3.5 Flash-Lite took 20 s+ while 3.1 Flash-Lite answered in ~3.5 s; the old order spent ~28 s on busy models |

### 2026-10-31

| # | Decision | Status | Why |
|---|---|---|---|
| D35 | **No scrolling in the graph panel; the chat never sticks to the screen edge; a new problem after "Solved" starts fresh.** The plot takes the height that's left so the whole graph card shows (compact styles in the panel, extras dropped when short); several graphs show one at a time with ‹ ›. When its circle leaves the screen the thread hides and a "Back to your question" pill appears; with no readable room round the circle it floats as a full card in a corner. After a solved turn, the next question resets the brain and opens a new thread | ✅ | Asked by the lead: the graph had to be scrolled to be seen, and the thread got stuck at the edge or squeezed when zoomed |
| D34 | **The chat and the graph panel are draggable.** Chat: by its "∂raft" pill (sticky at the top of the thread); once moved it keeps that offset from the circle, so it still follows the page; double-click the pill to let it place itself again; a moved thread may shrink to ~200 px and steps out from under the graph panel. Graph panel: by its header (with an iOS-style grabber; a tap still folds it); it floats where dropped, and docks again when dropped near its edge. Both track 1:1 from the grab point, rubber-band at the screen edges, and carry the flick's velocity into a spring (reduced motion: no throw) | ✅ | Asked by the lead; students need to move things off the part of the page they're working on |
| D33 | **Conversation as message bubbles beside the circle; graphs in their own panel.** The tutor's sentences are white iMessage-style bubbles (tail bottom-left), the student's blue (tail bottom-right), with a typing indicator, explain cards and written steps as bubbles, and a "Graph" link bubble. The thread is placed in screen space (sizes follow the screen, not the zoom) on whichever side of the circle has room, follows the camera every frame, never covers the circle, and scrolls when tall. Graphs: a glass panel on the right (≥ 900 px wide) or a sheet above the ask bar, foldable, opened again by a new graph or the link. Replaces D30's lesson column | ✅ | Asked by the lead: the column felt like a fixed box; bubbles around the circle read as a conversation about that exact spot, and graphs need their own space |
| D32 | **Integration (`integrate/all`)**: Part A's canvas is the base (PDF text and term positions, circle/selection context, handwriting → LaTeX, idle events, Layers, tutor-ink shapes) and hosts the lesson column (D30) instead of tutor-visual shapes; Part D's Mafs visuals replace main's SVG graph; **step/answer checking keeps the lead's engine** (D28/D29). Explain-card marks snap onto the printed term using Part A's text positions. Part A's selected-area panel and placeholder mic gave way to the lesson card and ask pill | ✅ | Cross-tests: the lead's checker caught 4/4 planted practice-sheet mistakes with no false alarm; Part D's checker caught 2/4 and marked Q7's right answer wrong. Each part keeps its best work; merges keep teammates' commits and authorship |
| D31 | **Part D uses Mafs for teaching graphs**, the standalone Compute Engine LaTeX parser, math.js for real arithmetic/differentiation, and KaTeX labels. Parameter updates preserve mounted visuals; uncertain math is never marked correct. Part D ships a separate local preview with temporary canvas/caption adapters. | ✅ | Implements Q13 and the Part D brief; integration and validation details in [part-d/INTEGRATION.md](part-d/INTEGRATION.md). Mafs shares the patched root KaTeX through an npm override. |
| D30 | **No chat panel.** Each circled problem gets a **lesson column** beside it (moves with pan/zoom): a lesson card (what ∂raft understood, the sentence being said, its question, "Solved"), then **explain cards** (`note` visual: variable / number / rule / mistake) with a leader line to their term, plus graphs and written steps. A new circle replaces the whole column; the ✕ on the lesson card closes it. Input is one floating glass **ask pill** (mic + text) above the toolbar. D28/D29 are taken on `part-d/math-visuals` | ✅ | A chat sidebar made it feel like a chatbot; explanations pinned to the exact terms feel like a tutor writing on the page |
| D29 | Lines with **∫** are checked by computing each ∫ f dx as ∫ from 1 to x (Simpson's rule) and comparing the lines **up to a constant**; a final answer without a constant letter is flagged "missing + C" | ✅ | One rule covers integration by parts, `+ C`, and different-looking right answers (−cos²x/2 vs sin²x/2) without symbolic integration |
| D28 | Math engine = **mathjs only** (already a dependency) + our own LaTeX/unicode converter; **no nerdamer, no compute-engine**. Checks numbers at random points; says `unsure`/`unparseable` instead of guessing, never throws | ✅ | No new library; the converter covers what students write; a false alarm is worse than staying quiet |
| D27 | Brain v1 runs on the **browser's own voice and speech recognition** (Chrome/Edge) as stand-ins; Gradium stays the target for Part C | 🟡 | Lets us demo the whole loop today; swapping the voice doesn't change the brain |
| D26 | Model order: **`gemini-3.5-flash-lite` first** (7 s timeout), then `3.8-flash`, a Lite retry, then `3.1-flash-lite` | ✅ | On 31 Oct Lite answered in ~2–4 s; Flash was often busy (503) or took 40 s+ |
| D25 | Brain = **one structured Gemini call per turn** (JSON schema: kind, doubt, beats + visuals, hint level, what to wait for), not a multi-step tool loop. Our code gathers context first and guards the reply (max 4 beats, max 1 worked step) | ✅ | One round trip = fast and predictable; easier to test and to keep from giving answers away |
| D24 | **Folder ownership is enforced**: branches `part-a/…` to `part-d/…`, each may only change its folders (`.github/parts.json`). A `part-guard` GitHub check fails pull requests that touch other parts; only the lead's `cross-part` label overrides; CODEOWNERS makes the lead review every merge; AI assistants follow the same rules via `CLAUDE.md`/`AGENTS.md` | ✅ | Asked by the lead so nobody changes another part's code. See [WORKING_RULES.md](WORKING_RULES.md) |
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
| Q13 | ~~Graph library: function-plot or Mafs?~~ | **Closed by D31:** Mafs, implemented and browser-tested by Part D |
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

## Part A implementation notes — 2026-10-31

- **Decided for this work:** the Part A assignee confirmed the updated canvas scope,
  including student handwriting and handwriting-to-LaTeX, replacing their earlier
  handwriting scope cut.
- **Decided for local testing:** use clearly labelled temporary stubs while the other
  parts are being built. The normal app uses Part A's server-side Gemini handwriting reader;
  recognition failures and unconnected voice report their status. Shared contracts are unchanged.
- **Part A reader:** `/app/read-ink` uses `gemini-3.5-flash-lite` with minimal thinking,
  existing dev/demo key names, bounded PNG requests and no automatic retries or paid fallback.
  Live desktop/recognition checks passed. The user confirmed development billing is disabled.
- **Part A demo device:** target laptops with trackpads. Tablet/stylus calibration is optional
  if hardware becomes available; it is not a requirement for the local demo.
- **Open integration handoff:** connect voice, session wiring and real graphs.
  Details: [PART_A_HANDOFF.md](PART_A_HANDOFF.md).

## Security incidents

| Date | What | Action |
|---|---|---|
| 2026-10-31 | Groq key `gsk_512c…` was shared in an AI chat (editor selection) | Key deleted in the Groq console, new key created ✅ |
