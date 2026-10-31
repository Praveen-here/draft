import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeCircle, pointInLoop } from "../circleDetect";
import { groupIntoLines } from "../lines";
import { overlap, padded, placeBeside, validBox } from "../geometry";
import { validateInk } from "../inkResult";

const ellipse = (w = 180, h = 70, arc = Math.PI * 2) => Array.from({ length: 65 }, (_, i) => ({
  x: 300 + Math.cos(i / 64 * arc) * w / 2,
  y: -100 + Math.sin(i / 64 * arc) * h / 2,
}));

test("recognises a closed selection in either direction and at translated coordinates", () => {
  assert.equal(looksLikeCircle(ellipse()), true);
  assert.equal(looksLikeCircle(ellipse().reverse()), true);
  assert.equal(looksLikeCircle(ellipse(600, 80)), true);
});
test("keeps dots, small letter loops and open curves as ordinary ink", () => {
  assert.equal(looksLikeCircle([{ x: 1, y: 1 }]), false);
  assert.equal(looksLikeCircle(ellipse(16, 20)), false);
  assert.equal(looksLikeCircle(ellipse(180, 70, Math.PI * 1.3)), false);
});
test("does not classify a figure eight or long scribble as a circle", () => {
  const eight = Array.from({ length: 101 }, (_, i) => ({
    x: Math.sin(i / 100 * Math.PI * 2) * 100, y: Math.sin(i / 100 * Math.PI * 4) * 60,
  }));
  assert.equal(looksLikeCircle(eight), false);
  assert.equal(looksLikeCircle([...ellipse(), ...ellipse(), ...ellipse()]), false);
});
test("rejects non-finite coordinates", () => {
  assert.equal(looksLikeCircle([...ellipse(), { x: NaN, y: Infinity }]), false);
  assert.equal(validBox({ x: Infinity, y: 0, w: 20, h: 20 }), false);
  assert.equal(validBox({ x: 0, y: 0, w: 0, h: 20 }), false);
});
test("content must be inside the loop, not just its bounding rectangle", () => {
  assert.equal(pointInLoop({ x: 300, y: -100 }, ellipse()), true);
  assert.equal(pointInLoop({ x: 388, y: -67 }, ellipse()), false);
});
test("groups nearby strokes while separating successive writing rows", () => {
  const grouped = groupIntoLines([
    { id: "b", bbox: { x: 25, y: 11, w: 16, h: 22 } },
    { id: "next", bbox: { x: 0, y: 60, w: 30, h: 24 } },
    { id: "a", bbox: { x: 0, y: 10, w: 18, h: 24 } },
  ]);
  assert.equal(grouped.length, 2);
  assert.deepEqual(new Set(grouped[0].shapeIds), new Set(["a", "b"]));
  assert.deepEqual(grouped[1].shapeIds, ["next"]);
});
test("superscripts join their base line while distant columns stay separate", () => {
  const grouped = groupIntoLines([
    { id: "base", bbox: { x: 0, y: 12, w: 20, h: 30 } },
    { id: "power", bbox: { x: 22, y: 2, w: 8, h: 9 } },
    { id: "other-column", bbox: { x: 600, y: 12, w: 20, h: 30 } },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.find((line) => line.shapeIds.includes("base"))?.shapeIds.includes("power"), true);
});
test("empty or invalid strokes do not create phantom lines", () => {
  assert.deepEqual(groupIntoLines([]), []);
  assert.deepEqual(groupIntoLines([{ id: "broken", bbox: { x: 0, y: 0, w: NaN, h: 20 } }]), []);
});
test("the reported integral and superscript stay together above a separate writing row", () => {
  const grouped = groupIntoLines([
    { id: "integral", bbox: { x: 175, y: 48, w: 95, h: 322 } },
    { id: "x", bbox: { x: 282, y: 129, w: 110, h: 109 } },
    { id: "power", bbox: { x: 338, y: 48, w: 60, h: 44 } },
    { id: "next", bbox: { x: 175, y: 450, w: 223, h: 109 } },
  ]);
  assert.equal(grouped.length, 2);
  assert.deepEqual(new Set(grouped[0].shapeIds), new Set(["integral", "x", "power"]));
  assert.deepEqual(grouped[1].shapeIds, ["next"]);
});
test("places visuals outside document and existing tutor work", () => {
  const target = { x: 100, y: 100, w: 240, h: 60 };
  const obstacles = [{ x: 0, y: 0, w: 820, h: 1100 }, { x: 844, y: 100, w: 360, h: 260 }];
  const placement = placeBeside(target, 360, 260, obstacles);
  assert.equal(obstacles.every((obstacle) => overlap(padded(placement), obstacle) === 0), true);
  assert.deepEqual(placeBeside(target, 100, 50, []), { x: 364, y: 100, w: 100, h: 50 });
});
test("the distant integral and derivative in the screenshot are two complete expressions", () => {
  const strokes = [
    { id: "integral", bbox: { x: 189, y: 412, w: 76, h: 457 } },
    { id: "x", bbox: { x: 312, y: 546, w: 119, h: 154 } },
    { id: "power", bbox: { x: 378, y: 456, w: 82, h: 76 } },
    { id: "plus-v", bbox: { x: 550, y: 526, w: 30, h: 149 } },
    { id: "plus-h", bbox: { x: 521, y: 598, w: 99, h: 17 } },
    { id: "two", bbox: { x: 662, y: 502, w: 135, h: 145 } },
    { id: "numerator", bbox: { x: 1826, y: 201, w: 81, h: 184 } },
    { id: "bar", bbox: { x: 1841, y: 383, w: 108, h: 50 } },
    { id: "denominator", bbox: { x: 1878, y: 466, w: 73, h: 125 } },
    { id: "variable", bbox: { x: 1944, y: 490, w: 77, h: 61 } },
  ];
  for (const input of [strokes, [...strokes].reverse()]) {
    const lines = groupIntoLines(input);
    assert.equal(lines.length, 2);
    assert.deepEqual(new Set(lines.find((line) => line.shapeIds.includes("integral"))?.shapeIds),
      new Set(["integral", "x", "power", "plus-v", "plus-h", "two"]));
    assert.deepEqual(new Set(lines.find((line) => line.shapeIds.includes("bar"))?.shapeIds),
      new Set(["numerator", "bar", "denominator", "variable"]));
  }
});
test("explicit equations stay separate even when a block is moved close together", () => {
  const lines = groupIntoLines([
    { id: "a", equationId: "first", bbox: { x: 0, y: 0, w: 20, h: 30 } },
    { id: "b", equationId: "first", bbox: { x: 200, y: 0, w: 20, h: 30 } },
    { id: "c", equationId: "second", bbox: { x: 25, y: 0, w: 20, h: 30 } },
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].shapeIds, ["a", "b"]);
  assert.deepEqual(lines[1].shapeIds, ["c"]);
});
test("small raised powers attach to their base without depending on a nearby integral", () => {
  const lines = groupIntoLines([
    { id: "base", bbox: { x: 456, y: 325, w: 13, h: 73 } },
    { id: "power", bbox: { x: 473, y: 285, w: 34, h: 29 } },
    { id: "previous-row", bbox: { x: 456, y: 180, w: 50, h: 73 } },
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.find((line) => line.shapeIds.includes("base"))?.shapeIds, ["base", "power"]);
});
test("slanted a+b and c+b stay in separate rows at different scales and stroke orders", () => {
  const strokes = [
    { id: "a", bbox: { x: 57, y: 123, w: 66, h: 104 } },
    { id: "plus1-h", bbox: { x: 125, y: 125, w: 47, h: 30 } },
    { id: "plus1-v", bbox: { x: 134, y: 115, w: 23, h: 47 } },
    { id: "b1-stem", bbox: { x: 158, y: 57, w: 45, h: 84 } },
    { id: "b1-loop", bbox: { x: 180, y: 76, w: 58, h: 43 } },
    { id: "c", bbox: { x: 130, y: 252, w: 58, h: 60 } },
    { id: "plus2-h", bbox: { x: 181, y: 194, w: 51, h: 27 } },
    { id: "plus2-v", bbox: { x: 191, y: 192, w: 34, h: 42 } },
    { id: "b2-stem", bbox: { x: 227, y: 138, w: 50, h: 76 } },
    { id: "b2-loop", bbox: { x: 253, y: 141, w: 58, h: 57 } },
    { id: "distant-a", bbox: { x: 900, y: 100, w: 20, h: 30 } },
    { id: "distant-b", bbox: { x: 935, y: 100, w: 20, h: 30 } },
  ];
  for (const scale of [0.5, 1, 2]) for (const reverse of [false, true]) {
    const input = strokes.map(({ id, bbox }) => ({ id, bbox: {
      x: (bbox.x + 700) * scale, y: (bbox.y - 300) * scale, w: bbox.w * scale, h: bbox.h * scale,
    } }));
    const lines = groupIntoLines(reverse ? input.reverse() : input);
    assert.equal(lines.length, 3);
    assert.deepEqual(new Set(lines.find((line) => line.shapeIds.includes("a"))?.shapeIds),
      new Set(["a", "plus1-h", "plus1-v", "b1-stem", "b1-loop"]));
    assert.deepEqual(new Set(lines.find((line) => line.shapeIds.includes("c"))?.shapeIds),
      new Set(["c", "plus2-h", "plus2-v", "b2-stem", "b2-loop"]));
  }
});
test("smoothed mouse strokes keep each slanted row together when each b is one stroke", () => {
  const strokes = [
    { id: "a", bbox: { x: 394, y: 333, w: 94, h: 121 } },
    { id: "plus1-v", bbox: { x: 500, y: 313, w: 34, h: 73 } },
    { id: "plus1-h", bbox: { x: 486, y: 327, w: 70, h: 40 } },
    { id: "b1", bbox: { x: 540, y: 227, w: 100, h: 94 } },
    { id: "c", bbox: { x: 506, y: 523, w: 73, h: 68 } },
    { id: "plus2-v", bbox: { x: 590, y: 431, w: 42, h: 60 } },
    { id: "plus2-h", bbox: { x: 576, y: 429, w: 70, h: 36 } },
    { id: "b2", bbox: { x: 645, y: 351, w: 103, h: 86 } },
  ];
  for (const input of [strokes, [...strokes].reverse()]) {
    const lines = groupIntoLines(input);
    assert.equal(lines.length, 2);
    assert.deepEqual(new Set(lines[0].shapeIds), new Set(["a", "plus1-v", "plus1-h", "b1"]));
    assert.deepEqual(new Set(lines[1].shapeIds), new Set(["c", "plus2-v", "plus2-h", "b2"]));
  }
});
test("unreadable, malformed and oversized recognition replies never become line events", () => {
  for (const invalid of [null, {}, [], [""], [17], ["a", "b"], ["x".repeat(4097)]]) {
    assert.throws(() => validateInk(invalid));
  }
  assert.deepEqual(validateInk(["  x + C  "]), ["x + C"]);
});

test("close writing rows stay separate despite tall letters and plus signs", () => {
  const row = (prefix: string, x: number, y: number) => [
    { id: prefix + "a", bbox: { x, y: y + 5, w: 24, h: 30 } },
    { id: prefix + "plus-v", bbox: { x: x + 45, y: y + 5, w: 3, h: 25 } },
    { id: prefix + "plus-h", bbox: { x: x + 36, y: y + 17, w: 24, h: 3 } },
    { id: prefix + "b", bbox: { x: x + 75, y: y - 8, w: 24, h: 43 } },
  ];
  for (const scale of [0.5, 1, 2]) for (const offset of [0, 10, 30]) for (const reverse of [false, true]) {
    const strokes = [...row("upper-", 0, 0), ...row("lower-", offset, 35)].map(({ id, bbox }) => ({ id,
      bbox: { x: (bbox.x + 600) * scale, y: (bbox.y - 200) * scale, w: bbox.w * scale, h: bbox.h * scale },
    }));
    const lines = groupIntoLines(reverse ? strokes.reverse() : strokes);
    assert.equal(lines.length, 2);
    assert(lines.every((line) => line.shapeIds.every((id) => id.startsWith(line.shapeIds[0].split("-")[0]))));
  }
});

test("writing above a larger letter is not its exponent unless it is raised to the right", () => {
  const lines = groupIntoLines([
    { id: "upper-row", bbox: { x: 0, y: 0, w: 20, h: 20 } },
    { id: "lower-row", bbox: { x: 0, y: 40, w: 24, h: 40 } },
    { id: "power", bbox: { x: 24, y: 22, w: 8, h: 10 } },
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.find((line) => line.shapeIds.includes("upper-row"))?.shapeIds, ["upper-row"]);
  assert.deepEqual(new Set(lines.find((line) => line.shapeIds.includes("lower-row"))?.shapeIds), new Set(["lower-row", "power"]));
});

test("a full-sized plus sign is not a superscript of writing on the next row", () => {
  const lines = groupIntoLines([
    { id: "plus-h", bbox: { x: 42, y: 17, w: 26, h: 1 } },
    { id: "plus-v", bbox: { x: 55, y: 4, w: 1, h: 27 } },
    { id: "lower-x", bbox: { x: 0, y: 35, w: 24, h: 34 } },
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.find((line) => line.shapeIds.includes("lower-x"))?.shapeIds, ["lower-x"]);
});

test("a standalone slanted a+b does not split when its b shifts a few pixels", () => {
  for (const shift of [-3, 0, 3, 6, 12]) {
    const lines = groupIntoLines([
      { id: "a", bbox: { x: 394, y: 333, w: 94, h: 121 } },
      { id: "plus-v", bbox: { x: 500, y: 313, w: 34, h: 73 } },
      { id: "plus-h", bbox: { x: 486, y: 327, w: 70, h: 40 } },
      { id: "b", bbox: { x: 540, y: 227 + shift, w: 100, h: 94 } },
    ]);
    assert.equal(lines.length, 1);
  }
});

test("existing members tolerate small spacing changes but still detach when moved far away", () => {
  const source = [
    { id: "a", bbox: { x: 0, y: 5, w: 24, h: 30 }, equationId: "source", previousEquationId: "source" },
    { id: "plus-v", bbox: { x: 45, y: 5, w: 3, h: 25 }, equationId: "source", previousEquationId: "source" },
    { id: "plus-h", bbox: { x: 36, y: 17, w: 24, h: 3 }, equationId: "source", previousEquationId: "source" },
  ];
  const b = { id: "b", bbox: { x: 98, y: -8, w: 24, h: 43 }, previousEquationId: "source" };
  assert.equal(groupIntoLines([...source, b]).length, 1);
  assert.equal(groupIntoLines([...source, { ...b, bbox: { ...b.bbox, x: 300 } }]).length, 2);
});
