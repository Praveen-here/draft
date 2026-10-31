import { test } from "node:test";
import assert from "node:assert/strict";
import { VisualStore, type AnimationClock } from "./animation";
import { areaPolygons, sampleCurve, tangentAt } from "./geometry";
import { finite, range, visualSpec, type CurveSpec } from "./model";
import { differentiateExpression, parseLatex } from "@/lib/math";

function clock() {
  let now = 0, id = 0, reduced = false;
  const queue = new Map<number, (time: number) => void>();
  const api: AnimationClock = {
    now: () => now,
    request: (callback) => { queue.set(++id, callback); return id; },
    cancel: (key) => { queue.delete(key); },
    reducedMotion: () => reduced,
  };
  return {
    api, queue,
    reduce: () => { reduced = true; },
    advance(ms: number) {
      now += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((callback) => callback(now));
    },
  };
}
const plot = (): CurveSpec => ({ kind: "plot", fn: "a*x^2", xRange: [-3, 3], yRange: [-4, 8], params: { a: 1 } });

test("parameter animation updates the existing store and reaches the exact destination", () => {
  const time = clock(), store = new VisualStore(plot(), time.api);
  let updates = 0;
  store.subscribe(() => updates++);
  store.animate("a", 1, 3, 1000);
  assert.equal(store.getSnapshot().spec.params.a, 1);
  time.advance(100);
  assert.ok(store.getSnapshot().spec.params.a > 1 && store.getSnapshot().spec.params.a < 3);
  time.advance(900);
  assert.equal(store.getSnapshot().spec.params.a, 3);
  assert.equal(store.getSnapshot().animating, false);
  assert.equal(time.queue.size, 0);
  assert.ok(updates >= 3);
});
test("retargeting starts at the current value, not a stale from value", () => {
  const time = clock(), store = new VisualStore(plot(), time.api);
  store.animate("a", 1, 3, 1000);
  time.advance(120);
  const atInterruption = store.getSnapshot().spec.params.a;
  store.animate("a", 1, -2, 1000);
  assert.equal(store.getSnapshot().spec.params.a, atInterruption);
  assert.equal(time.queue.size, 1);
  time.advance(1000);
  assert.equal(store.getSnapshot().spec.params.a, -2);
});
test("reduced motion updates immediately, including when the preference changes mid-animation", () => {
  const time = clock(), store = new VisualStore(plot(), time.api);
  store.animate("a", 1, 3, 1000);
  time.reduce();
  time.advance(16);
  assert.equal(store.getSnapshot().spec.params.a, 3);
  store.animate("a", 3, 0.5, 3000);
  assert.equal(store.getSnapshot().spec.params.a, 0.5);
  assert.equal(time.queue.size, 0);
});
test("dragging a control interrupts its animation", () => {
  const time = clock(), store = new VisualStore(plot(), time.api);
  store.animate("a", 1, 3, 1000);
  store.setParam("a", 2);
  time.advance(1500);
  assert.equal(store.getSnapshot().spec.params.a, 2);
  assert.equal(time.queue.size, 0);
});
test("independent parameters animate together and disposal cancels every frame", () => {
  const time = clock(), store = new VisualStore(plot(), time.api);
  store.animate("a", 1, 3, 1000);
  store.animate("b", 0, 2, 500);
  assert.equal(time.queue.size, 2);
  time.advance(200);
  store.stop();
  const snapshot = store.getSnapshot();
  assert.equal(time.queue.size, 0);
  time.advance(1000);
  assert.equal(store.getSnapshot(), snapshot);
  store.dispose();
  store.animate("a", 1, 10, 1000);
  assert.equal(time.queue.size, 0);
});

test("a reciprocal curve has a real gap at its pole", () => {
  const segments = sampleCurve((x) => 1 / x, [-3, 3], [-4, 4]);
  assert.equal(segments.length, 2);
  assert.ok(segments.every((segment) => segment.every(([x]) => x < 0) || segment.every(([x]) => x > 0)));
});
test("off-grid asymptotes are also split", () => {
  const segments = sampleCurve((x) => 1 / (x - 0.013), [-3, 3], [-4, 4]);
  assert.ok(segments.length >= 2);
  assert.ok(segments.every((segment) => !(segment[0][0] < 0.013 && segment.at(-1)![0] > 0.013)));
});
test("area shading never bridges an undefined region", () => {
  const areas = areaPolygons((x) => 1 / x, -2, 2, [-4, 4]);
  assert.equal(areas.length, 2);
  assert.ok(areas.every((area) => area.every(([x]) => x < 0) || area.every(([x]) => x > 0)));
  assert.deepEqual(areaPolygons((x) => x * x, 1, 1, [-4, 8]), []);
});
test("tangent values use the mathematical derivative and reject corners", () => {
  const curve = parseLatex("x^2")!;
  assert.equal(tangentAt(curve, differentiateExpression(curve), 2, {})?.slope, 4);
  const cusp = parseLatex("abs(x)")!;
  assert.equal(tangentAt(cusp, differentiateExpression(cusp), 0, {}), null);
});
test("invalid ranges, non-finite values, and executable input fields are rejected", () => {
  for (const value of [[1, 1], [2, -2], [NaN, 2], [0, Infinity], [1], "0,2"])
    assert.throws(() => range(value, [-4, 4]));
  for (const value of [Infinity, NaN, "1", true]) assert.throws(() => finite(value, "test"));
  assert.throws(() => visualSpec({ type: "plot", id: "x", fn: "x", xRange: [-4, 4], params: { x: 2 }, near: { shapeId: "a" } }));
});
test("ready-made visual arguments match the public tool contract", () => {
  const near = { shapeId: "test" };
  const tangent = visualSpec({ type: "showVisual", kind: "tangent", args: { fn: "x^2", at: 2 }, near });
  assert.equal(tangent.params.at, 2);
  const area = visualSpec({ type: "showVisual", kind: "area", args: { fn: "x^2", from: 0, to: 2 }, near });
  assert.deepEqual(area.params, { from: 0, to: 2 });
  assert.equal(visualSpec({ type: "showVisual", kind: "numberLine", args: { values: [-2, 0, 2] }, near }).kind, "numberLine");
  assert.equal(visualSpec({ type: "showVisual", kind: "table", args: { fn: "x^2", xs: [0, 1, 2] }, near }).kind, "table");
});
