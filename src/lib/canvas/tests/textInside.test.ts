// What counts as "printed text inside the circle" (context.ts textInside). Run with the other canvas tests:
// npx tsx --test src/lib/canvas/tests/textInside.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { textInside } from "../pdfText";

const q6 = { text: "6. Find the integral of x·e^x dx.", bbox: { x: 100, y: 425, w: 300, h: 17 } };
const q7 = { text: "7. Simplify (x² - 9) / (x - 3).", bbox: { x: 100, y: 470, w: 270, h: 18 } };
const q1 = { text: "y = a·x²", bbox: { x: 200, y: 100, w: 80, h: 20 } };

test("a circle round handwriting between two printed lines takes neither line", () => {
  // The case that sent Q6 and Q7 to the tutor: the circle only grazes them.
  assert.deepEqual(textInside([q6, q7], { x: 140, y: 439, w: 200, h: 38 }), []);
});

test("a circle round a whole printed line takes that line", () => {
  assert.deepEqual(textInside([q6, q7], { x: 90, y: 418, w: 320, h: 30 }).map((t) => t.text), [q6.text]);
});

test("a circle round part of a line takes only that part", () => {
  const [part] = textInside([q1], { x: 228, y: 95, w: 24, h: 30 });
  assert.ok(part, "something is inside");
  assert.ok(part.text.length < q1.text.length, `took "${part.text}", not the whole line`);
  assert.ok(part.text.includes("a"), `took "${part.text}"`);
  assert.ok(part.bbox.x >= 228 - 12 && part.bbox.x + part.bbox.w <= 252 + 12, "its box is where it is");
});

test("a circle well beside the text takes nothing", () => {
  assert.deepEqual(textInside([q1], { x: 400, y: 95, w: 50, h: 30 }), []);
});
