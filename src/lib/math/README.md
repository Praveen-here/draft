# Part D: Math engine and visuals

**Branch:** `part-d/math-visuals` · **Spec:** [AGENT_BRAIN.md](../../../docs/AGENT_BRAIN.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

Part D provides real math checks and teaching visuals. It can run independently of the other parts in the [Math studio preview](../../components/visuals/preview) (run `npm run part-d:preview`, then open http://127.0.0.1:4173).

## Status

- [x] LaTeX and plain-expression parsing: fractions, powers, exponentials, trig, roots, logs, and derivative notation.
- [x] Step and answer checking (`createMathApi`, the lead's engine, D28/D29): values compared at seeded random points; lines with ∫ compared up to a constant (each ∫ computed from 1 to x); equations by their real solutions (any function, not only quadratics); `dy/dx = …` against the derivative; worded questions ("6. Find the integral of …"); missing `+ C` flagged. Catches all four planted mistakes on the practice sheet. Cancelling a factor like `(x−3)/(x−3)` counts as fine (Part D's earlier checker said "unsure" here).
- [x] Mafs graphs and interruptible parameter animation, with reduced-motion support.
- [x] Tangent, area, number-line, and value-table visuals.
- [x] KaTeX labels with accessible MathML.
- [x] Three demo problems, a script, screenshots, and a captioned Part D backup video.
- [ ] Full canvas + brain + voice rehearsal after the other parts are connected.

## Public entry

```ts
import { createMathApi } from "@/lib/math";

const math = createMathApi();
await math.checkStep("2*(x+3)", "2*x+6");
// { ok: true }
await math.checkAnswer("\\int x e^x\\,dx", "x e^{x}-e^x+C");
// { ok: true }
```

`parseLatex` and `differentiateExpression` are also public for graph evaluation. Inputs are parsed as arithmetic trees, never executed as JavaScript. Assignments, property access, arbitrary functions, incomplete input, and oversized expressions are rejected.

## Result handling

- `ok: true`: the supported checks passed.
- `reason: "not-equivalent"`: a numerical mismatch or changed polynomial solution set was found.
- `reason: "unparseable"`: unsupported/incomplete notation; ask the student to confirm the transcription.
- `reason: "unsure"`: insufficient real samples, changed domains, or a transformation needing more context.

**The brain must not treat `unparseable` or `unsure` as a wrong student answer.** Keep the existing `StepCheck` contract. The checker gives no worked solution.

Numerical equivalence is evidence, not a general proof. Fractions retain their domain restrictions: cancelling `(x-10)/(x-10)` produces `unsure` unless the missing restriction is handled elsewhere. Non-polynomial equation transformations are conservative. Definite integrals, inequalities, systems, matrices, complex arithmetic, and arbitrary natural-language questions are outside this version's verifier.

Use `\ln(x)` or `ln(x)` for natural logarithms. LaTeX `\log(x)` is base 10; plain `log(x)` follows math.js and is natural log. Variables are Latin letters or supported Greek names; `e` and `pi` are constants.

## Files

| File | Purpose |
|---|---|
| `parse.ts` | Part D: bounded LaTeX/MathJSON parsing and evaluation, used by the graphs (`parseLatex`) |
| `calculus.ts` | Part D: symbolic derivatives, used by the tangent visual (`differentiateExpression`) |
| `checkStep.ts` | The shared `MathApi`: `checkStep` and `checkAnswer` |
| `lineParse.ts` | The checker's reader: LaTeX / unicode / plain lines with `=`, `∫ … dx`, `d/dx`, `\log_b`, implicit multiplication |
| `sampling.ts` | The checker's random-point comparison, equation roots |
| `math.test.ts` | Part D's parser and derivative tests (`npm run part-d:test`) |
| `check.test.ts` | 75 checker cases, incl. the practice sheet (`npx tsx src/lib/math/check.test.ts`) |

## Test and hand off

```sh
npm run part-d:test
npm run part-d:preview
npm run part-d:e2e
npm run build
node .github/scripts/part-guard.mjs --local
```

The preview uses a temporary canvas adapter and caption sequence. It calls the real `MathApi` and `VisualsApi`; it does not use `fakeMath` or `fakeVisuals`. All source files stay inside Part D's folders. See [integration notes](../../../docs/part-d/INTEGRATION.md) and [demo script](../../../docs/part-d/DEMO.md).
