# ∂raft: Team Guide (simple version)

A short, plain-language explanation of what we're building, what each tool does, and how it fits together.
The approach is **not final yet**. This describes the current plan.

---

## 1. What are we building?

A math tutor app for an **iPad or Android tablet**.

1. The student **opens their homework PDF** in the app.
2. They **write on it with a stylus**, as on paper.
3. When stuck, they **circle** the part they don't understand, with the same pen. There's no circle button; the app notices the circle by itself.
4. They **tap the mic button** and **ask out loud**: "why is there a minus here?" Tapping it again stops the app listening.
5. ∂raft **looks at what was circled, listens, and explains that exact step out loud**, like a friend sitting next to them.
6. It **talks while it draws**: graphs, highlights and values that change on screen as it speaks.
7. It asks **"Did you get it?"** and a quick check question, then **changes its explanation** based on the answer.
8. It gives **hints, not the full answer**, then lets the student try the next line and **checks it with a math engine**.
9. It **keeps going until the student can do it** (or explain it back), and it **steps in by itself** when it spots a mistake.

**Our core feature is the tutor's brain** (the "Agent Brain"): it decides what to say, what to draw, when to ask and when to stay quiet. Full details: [AGENT_BRAIN.md](AGENT_BRAIN.md).

**Our main point:** other apps (Photomath, ChatGPT) give the answer. ∂raft helps you *understand*, and you can point at the exact step you're stuck on, with no screenshots or typing.

---

## 2. The tools, in simple terms

| Tool | What it does for us | Like… | Cost |
|---|---|---|---|
| **Next.js + React** | The app (screens) and the small backend | The body of the app | Free |
| **tldraw** | The canvas: pen writing, circling, zooming | The paper and pencil | Free (small watermark) |
| **pdf.js** | Shows the PDF and reads its printed text | The photocopier | Free |
| **Google Gemini (Flash)** | The **brain**: reads the circled area, understands the doubt, plans and writes the explanation | The teacher | Free tier |
| **Gemini Flash-Lite** | Backup brain if Gemini Flash hits its limit | Substitute teacher | Free tier |
| **Gradium** | **Ears and mouth**: speech-to-text and text-to-speech | Ears and voice | Free plan (45k credits/month per account) |
| **Groq** (Qwen model) | **The doorman**: decides "was that sentence meant for me?" so ∂raft doesn't reply to every mutter | A receptionist | Free tier |
| **nerdamer / math.js** | **Calculator that can't lie**: checks whether a step is actually correct | The answer key | Free |
| **function-plot** | Draws graphs on the canvas | Graph paper | Free |
| **KaTeX** | Displays math nicely in explanation cards | Neat handwriting | Free |
| **Vercel** | Puts the app online | The building it lives in | Free |

**The only button the student needs is the mic button.** Mic on means "I'm talking to you"; mic off means the app hears nothing. Because of this, the "doorman" (Groq) is now just a backup, not a must-have.

**Jev (TypeSafe):** in our slides as the "doorman", but it needs a $5 top-up. Groq did the same job for free in our tests (14/14 correct, ~270 ms), so **Groq is the plan for now**. See [DECISIONS.md](DECISIONS.md).

---

## 3. How one doubt flows through the app

```
Student circles a step with the pen  ──►  app detects "that's a circle"
                                          and remembers that area
Student taps 🎙 mic ON and speaks    ──►  Gradium turns speech into text
                         │                (mic OFF = app hears nothing)
                         ▼
     Gemini looks at: the circled area + what was said
     + the earlier lines → finds the real doubt → plans
                 │
     ┌───────────┼──────────────┬───────────────┐
     ▼           ▼              ▼               ▼
 Read the ink  Check the math  Draw a graph   Pick hint level
 (Gemini)      (nerdamer)      (function-plot) (nudge/hint/step)
                 │
                 ▼
     Gradium speaks the explanation + the canvas shows a tick,
     highlight, or graph
                 │
                 ▼
     Student writes the next line → math engine checks it → ✓
```

---

## 4. How ∂raft teaches (the hint ladder)

| Level | What ∂raft does | When |
|---|---|---|
| 1. Nudge | Asks a guiding question ("What's the rule for ∫u dv?") | Default |
| 2. Hint | Gives the rule or idea, not the result | After a wrong try or "still don't get it" |
| 3. Worked step | Writes **only the next line** on the canvas, in a different colour | Student says "show me", or fails twice |

Then it hands control back: "Your turn for the next line."
**We do not auto-solve the whole problem.** That would make us another Photomath.

---

## 5. How the PDF and your writing stay separate

Think of it as **two sheets of glass**:

- **Bottom sheet (locked):** the PDF page. You can't move or erase it.
- **Top sheet:** everything written. Each mark is labelled as written by the **student** or the **tutor**, and the tutor writes in a different colour.

When you circle something, ∂raft collects:
1. the **printed text** inside the circle (read directly from the PDF, exact and free),
2. a picture of **only your handwriting** inside the circle,
3. a picture of **both together** for context.

---

## 6. Keys and environments, simply

- We have **two environments**:
  - **dev**: for building and testing. Use freely.
  - **demo**: only for judging day. **Don't touch it while building.**
- Every service has a **dev key** and a **demo key**, named like `GEMINI_KEY_DEV` / `GEMINI_KEY_DEMO`.
- Keys live in `.env.local` on your laptop (never in git), in the password manager, and in Vercel.
- Each teammate should create **their own dev accounts** (Gemini, Gradium, Groq), so we each get our own free limits.

Step-by-step: [SETUP_GUIDE.md](SETUP_GUIDE.md).

---

## 7. Who does what (4 parts, D23)

| Part | Area | In one line |
|---|---|---|
| A | **Canvas eyes and hands** | Detects circles and lines, reads handwriting, draws the tutor's highlights, ticks and steps |
| B | **Agent Brain** (core; the lead) | The teaching loop: what to say, draw and ask next; adapts until the student gets it |
| C | **Voice and player** | Mic button, speech in and out, interruptions, and **speaking + drawing at the same moment** |
| D | **Math and visuals** | Checks steps, draws graphs with values that change live, plus the demo script |

Owners for A, C and D are still to be assigned. Each part has its own folder and talks to the others only through shared "contracts" (agreed data shapes), so we can build in parallel. Details and build order: [AGENT_BRAIN.md §8–9](AGENT_BRAIN.md).

---

## 8. Things that could break (and our backup)

| Problem | Backup |
|---|---|
| Can't read handwriting | Show what it read: "Did you mean this?" |
| Unclear circle | Ask: "This step, or the whole problem?" |
| Gemini and the math engine disagree | Trust the engine, retry once, otherwise say "I'm not sure" |
| Gemini limit reached | Switch to Flash-Lite |
| Gradium down | Gemini TTS, then the browser's built-in voice; Groq Whisper for speech-to-text |
| Noisy hackathon hall | Headset; keep the **mic off** except while asking |
| A normal stroke is mistaken for a circle (or the reverse) | Treat unclear loops as writing; ask "this step, or the whole problem?" when the student asks |
| Venue Wi-Fi bad | Phone hotspot + a recorded backup demo video |
