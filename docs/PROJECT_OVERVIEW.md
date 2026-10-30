# Project Overview

Source: our hackathon submission deck, plus what we've discussed since.

Track: **Education** · Team of 4

## One line

**∂raft:** circle any math problem on your iPad or tablet, ask out loud, and it teaches you that exact step.

## The problem

- **Who:** students like *Ananya, 17, Class 12*, at 11:40 pm with an exam tomorrow, stuck on one step with nobody to ask.
  > "I'm stuck on one step and I don't even know what to search."
- **How often:** 3–5 times per homework session, almost every day (from our own weekly math work).
- **Cost today:** about **20 minutes lost per doubt**, or she copies the answer and learns nothing.

## What exists and where it falls short

| Today | Gap |
|---|---|
| Photomath / Google Lens: photo → full solution | Gives the **answer, not the understanding** |
| ChatGPT / Gemini apps: screenshot, upload, type | **Can't see your page.** You can't point at the one step you don't get |
| Friends, teachers, YouTube | Good help, but not available late at night |

## What ∂raft does

1. **Circle it:** draw around a problem, or just the one step you don't get.
2. **Ask it:** just talk ("why is there a minus here?"). No typing, no screenshots.
3. **Learn it:** it explains that exact part out loud, step by step, then lets you try and checks your answer.

## Why it's agentic, not a simple app

- "Why is this minus here?" means nothing on its own. The agent must **combine what you circled, what you said, and your earlier lines**.
- One doubt is many steps: **see → hear → read → check → explain → wait → check again**.
- A single API call can't watch your page, remember your hint level, or prove the math is right.

## How the agent decides (from the deck)

- **Trigger:** you circle something, ask out loud, or stop writing for 3 seconds.
- **Understand:** a gate model checks you're really asking; Gemini combines the circled area and your words to find the real doubt.
- **Plan:** read the ink → check the math → pick a hint level → explain.
- **Done:** when you solve the next step yourself and the math engine confirms it.

## Failure handling (from the deck)

- Can't read writing → shows what it read, asks "did you mean this?"
- Unsure what was circled → "this step, or the whole problem?"
- AI and math engine disagree → trust the engine, retry once, then "I'm not sure".
- API down → fall back to Gemini Flash-Lite and the browser's voice.

## Feasibility (from the deck)

- **Cost:** free tiers cover the build.
- **Speed goal:** under 3 seconds from question to spoken answer.
- **Effort:** 4 people, 24 hours.
- **Could break:** messy handwriting, unclear circles, noisy rooms, free-tier limits.

## What didn't work (from the deck)

- **Writing answers in the student's exact handwriting:** needs a trained model and many samples, not possible in 24 h. We use a **handwriting-style font** instead, with stroke animation.
- **Checking every pen stroke:** too slow and burned the quota. Now it checks only on **circle, ask, or pause**.

## Users and impact

- **First 10 users:** classmates from our first-year Engineering Maths class.

| Before | With ∂raft |
|---|---|
| Stuck 20 min, then copies | Unstuck in about a minute |
| Screenshot, upload, type | Circle it and ask |
| Gets the answer | Understands why, solves it alone |

## Next 30 days (after the hackathon)

- **Paper mode:** point a phone camera at a normal notebook.
- **Indian languages:** Hindi, Kannada and Hinglish voice.
- **Teacher view:** which topics a class gets stuck on.

## Demo story (the scenario we rehearse)

**Q4. Find ∫ x eˣ dx**

1. **Stuck:** Ananya has written `= x eˣ − ∫ eˣ dx` and doesn't get the minus.
2. **Circle it:** she circles `− ∫ eˣ dx`.
3. **Ask it:** "why the minus?" → ∂raft: "It's part of the rule ∫u dv = uv − ∫v du. Try the last bit!" (hint 1 of 3)
4. **Solve it:** she writes `= x eˣ − eˣ + C` → math engine ✓. *2 minutes, not 20.*

## Slides that need updating

- Slides 1, 3, 4 and 5 mention **TypeSafe Jev** as the gate. Current plan is **Groq** (see [DECISIONS.md](DECISIONS.md)). Update them if the decision holds.
- Add measured numbers (gate ~270 ms, etc.) once the full pipeline is tested.
