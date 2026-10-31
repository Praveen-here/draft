# Part D demo script

## The three problems

1. **Integration by parts:** find ∫ x eˣ dx. This demonstrates a valid next line, a sign error, and final-answer verification.
2. **Slope:** explore the derivative of x² with a tangent sliding from x = -2 through 0 to 2. Show pointwise slope values and ask the student to infer the relationship.
3. **Accumulation:** explore the region under x² between x = 0 and a moving right boundary. Show the region without displaying its evaluated integral.

The number line and value table are available as alternate explanations if the learner needs a simpler picture.

## Run the independent Part D demo (about 60 seconds)

Start `npm run part-d:preview`, open http://127.0.0.1:4173, and keep the original application on port 3000 available separately.

| Time | Action | What to say / check |
|---|---|---|
| 0–8 s | Open Slope & tangent. Drag the tangent position. | "The green line tells us the slope exactly where the student is looking." |
| 8–17 s | Play explanation. | The captions and tangent change together. Pause freezes the value; a new command can redirect it. |
| 17–26 s | Open Changing a curve; play. | "The axes stay fixed while a changes, so the student can see steepness change." |
| 26–34 s | Open Area; move the boundaries. | "The visual teaches what is accumulating. It does not hand over the final answer." |
| 34–42 s | Choose Correct step, then Check my work. | The valid integration-by-parts step receives a check. |
| 42–50 s | Choose Sign mistake, then check. | The engine catches the sign error without supplying a corrected answer. |
| 50–56 s | Choose Needs context, then check. | Cancelling a denominator keeps a restriction; uncertainty is not counted as a wrong answer. |
| 56–60 s | Open Value table or Number line. | "A different picture is ready when the student needs another angle." |

For the final integral answer check, switch to Check an answer, use `\int x e^x\,dx`, and enter `x e^{x}-e^x+C`. It passes by differentiating the answer; changing the minus to a plus fails.

## Interactive Function Lab

Open `http://127.0.0.1:4173/#function-lab`. Try the wave, cubic, or reciprocal examples. Change a coefficient with its slider, drag the point to read x and f(x), then choose Tangent or Area and drag the green point or boundary handles.

For a custom example, enter `a*cos(b*x)+c`, draw it, and change a, b, and c. View range changes the window of interest. A malformed expression keeps the last graph available. Mouse, keyboard, and touch are supported; picking up a lesson's point pauses its scripted explanation.

## Full team rehearsal after integration (90 seconds)

This is the planned live script. It requires Parts A, B, and C; the standalone recording below does not substitute for this integration test.

| Time | Student / presenter | Expected app behavior |
|---|---|---|
| 0–10 s | Open the worksheet, circle ∫ x eˣ dx, turn the mic on, ask how to begin. | A sends the circle and C sends the question. B asks what the student thinks. |
| 10–25 s | Give a plausible but incomplete idea. | B gives one hint; C speaks while A highlights the relevant terms. |
| 25–40 s | Ask why u = x is useful. | B asks a small check question. Use the value table/graph if it helps. |
| 40–55 s | Write `x e^x - ∫e^x dx`. | D verifies the valid next step; A shows a quiet tick. |
| 55–65 s | Deliberately switch the minus to a plus. | D reports a mismatch; B asks the student to inspect the sign. |
| 65–75 s | Correct it and finish `x e^x - e^x + C`. | D verifies by differentiation; B asks the student to explain the choice of u. |
| 75–90 s | Switch to the x² slope example. | B/C drive a tangent animation while speaking, then hand control back to the learner. |

Before judging: rehearse on the actual tablet, confirm mic-off behavior and interruption, check that a circle does not cover the relevant writing, and record the fully integrated backup with voice. Use development keys during rehearsal.

## Short pitch

"∂raft helps a student understand the step they are stuck on. They circle it and ask. The tutor explains with a picture, checks their understanding, and lets them try the next line. A separate math engine checks the work, so a confident-sounding AI answer is not enough. We are showing understanding, one step at a time."

## Recorded assets

- [Part D backup video](math-visuals-demo.webm): silent, captioned local preview with real math and visuals, and temporary canvas/narration adapters.
- [Function Lab desktop](function-lab-desktop.png)
- [Function Lab tablet](function-lab-tablet.png)
- [Function Lab phone](function-lab-phone.png)
- [Desktop screenshot](preview-desktop.png)
- [Tablet screenshot](preview-tablet.png)
- [Phone screenshot](preview-phone.png)

To regenerate, start the preview and run `node src/components/visuals/preview/record.mjs`. Playwright's FFmpeg helper is needed for video (`npx playwright install ffmpeg` once). Set `PART_D_FFMPEG` to the FFmpeg executable path to trim loading footage and generate the video poster. Recording uses a headless Edge browser and captures no microphone or personal desktop content.
