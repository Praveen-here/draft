import { createElement } from "react";
import { type Editor, type TLShapeId } from "tldraw";
import type { CanvasApi, CanvasEvent } from "@/lib/contracts";
import type { CanvasHandle } from "../canvasApi";
import type { InkRecognizer } from "../readInk";
import { documentPages, shapeBox, studentInk } from "../context";
import { overlap, union, validBox } from "../geometry";
import { addCircle, addHighlight, addLine, focusSample, loadWorksheet, sampleTarget } from "./fixtures";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextEvent<T extends CanvasEvent["type"]>(api: CanvasApi, type: T, action: () => void): Promise<Extract<CanvasEvent, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { off(); reject(new Error("Timed out waiting for " + type)); }, 12000);
    const off = api.onEvent((event) => {
      if (event.type === type) { clearTimeout(timer); off(); resolve(event as Extract<CanvasEvent, { type: T }>); }
    });
    try { action(); } catch (error) { clearTimeout(timer); off(); reject(error); }
  });
}

export async function runCanvasChecks(editor: Editor, api: CanvasHandle, controls: {
  setReader: (reader: InkRecognizer) => void;
  readCount: () => number;
  report: (message: string) => void;
}) {
  controls.setReader(async () => ["x + C"]);
  const pass = (name: string) => controls.report("PASS · " + name);
  const click = (label: string, modifiers: MouseEventInit = {}) => {
    const control = document.querySelector<HTMLElement>('[aria-label="' + label + '"]');
    check(control, "Missing control: " + label);
    control.dispatchEvent(new MouseEvent("click", { bubbles: true, ...modifiers }));
  };
  const pointing = (down: boolean) => editor.dispatch({
    type: "pointer", name: down ? "pointer_down" : "pointer_up", target: "canvas", point: { x: 0, y: 0 },
    pointerId: 1, button: 0, isPen: false, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, accelKey: false,
  });
  const pages = await loadWorksheet(editor);
  check(pages.length === 2 && pages.every((page) => page.textItems.length > 0), "PDF text was lost.");
  for (const page of pages) for (const item of page.textItems) {
    check(validBox(item.bbox) && item.bbox.x >= 0 && item.bbox.y >= 0 &&
      item.bbox.x + item.bbox.w <= page.w + 1 && item.bbox.y + item.bbox.h <= page.h + 1, "PDF coordinates are outside the rendered page.");
  }
  pass("PDF text and rotated-page coordinates");

  const circle = await nextEvent(api, "circle", () => { addCircle(editor); });
  check(circle.context.pageNo === 1 && circle.context.pdfText.includes("integral"), "Wrong selected PDF text.");
  check(circle.context.cropImage.startsWith("data:image/png") &&
    circle.context.inkOnlyImage.startsWith("data:image/png") &&
    circle.context.cropImage !== circle.context.inkOnlyImage, "Crops did not separate document and ink.");
  pass("Automatic circle, printed text and separate PNG crops");

  const rotated = await nextEvent(api, "circle", () => { addCircle(editor, sampleTarget(editor, 2)); });
  check(rotated.context.pageNo === 2 && rotated.context.pdfText.includes("Second page"), "Wrong PDF page selected.");
  pass("Circle selects the correct page after rotation");

  const printedLine = sampleTarget(editor);
  const term = await nextEvent(api, "circle", () => { addCircle(editor, { ...printedLine, w: 48 }); });
  check(term.context.pageNo === 1 && term.context.pdfText.includes("Find") && term.context.bbox.w < printedLine.w,
    "Circling one term inside a long PDF text item failed.");
  pass("A small circle can select one term of a longer PDF line");

  let writingIds: TLShapeId[] = [];
  const line = await nextEvent(api, "line", () => { writingIds = addLine(editor); });
  check(line.latex === "x + C" && "bbox" in line.target, "Line recognition did not emit the agreed contract.");
  const calls = controls.readCount();
  const recognised = await api.readInk();
  check(recognised.includes("x + C") && controls.readCount() === calls, "Unchanged ink was recognised twice.");
  pass("Grouped line event and recognition cache (fixture reader)");

  const moved = editor.getShape(writingIds[3]);
  check(moved, "Missing fixture stroke.");
  const oldBounds = union(studentInk(editor).map((shape) => shapeBox(editor, shape)));
  const circleEvents: CanvasEvent[] = [];
  const offCircle = api.onEvent((event) => { if (event.type === "circle") circleEvents.push(event); });
  await nextEvent(api, "line", () => { editor.updateShape({ id: moved.id, type: "draw", x: moved.x + 3 }); });
  offCircle();
  check(controls.readCount() === calls + 1 &&
    JSON.stringify(oldBounds) === JSON.stringify(union(studentInk(editor).map((shape) => shapeBox(editor, shape)))),
    "A moved stroke with unchanged overall bounds used stale recognition.");
  check(circleEvents.length === 0, "Editing ink incorrectly emitted a new selection.");
  pass("Ink edits invalidate recognition without retriggering circle events");

  const area = union([sampleTarget(editor), ...studentInk(editor).map((shape) => shapeBox(editor, shape))]);
  const mixed = await nextEvent(api, "circle", () => { addCircle(editor, area); });
  check(mixed.context.recentLines.includes("x + C") && mixed.context.inkOnlyImage !== circle.context.inkOnlyImage, "Ink or recent lines were missing.");
  pass("Combined selection includes writing and recent LaTeX");

  const highlightId = addHighlight(editor);
  const highlighted = await nextEvent(api, "circle", () => { addCircle(editor, area); });
  check(highlighted.context.cropImage !== mixed.context.cropImage && highlighted.context.inkOnlyImage === mixed.context.inkOnlyImage,
    "Student highlighting is missing from context or leaked into handwriting recognition.");
  pass("Student highlights appear in context while handwriting crops stay separate");

  const originalInk = JSON.stringify(studentInk(editor));
  const target = { bbox: sampleTarget(editor) };
  api.draw({ type: "highlight", target, colour: "blue" });
  api.draw({ type: "writeStep", near: target, text: "d/dx x = 1" });
  for (const kind of ["tick", "cross", "circle"] as const) api.draw({ type: "mark", target, kind });
  check(editor.getCurrentPageShapes().filter((shape) => shape.type === "tutor-ink").length === 4, "Missing tutor marks.");
  pass("Highlight, tick, cross and circle render as tutor ink; the step is a bubble in the lesson thread");

  // Graphs live in the graph panel (D33), never as shapes over the PDF.
  api.mountVisual("fixture", target, createElement("p", null, "Graph placeholder"));
  check(api.visuals.has("fixture"), "Visual was not mounted.");
  check(api.visuals.get().anchor, "The lesson has nothing to float around.");
  api.mountVisual("fixture", target, createElement("p", null, "Replacement graph"));
  check(api.visuals.get().items.filter((item) => item.id === "fixture").length === 1, "Same visual ID created duplicates.");
  api.unmountVisual("fixture");
  check(!api.visuals.has("fixture"), "Visual did not unmount.");
  pass("Graph placement, replacement and unmount");

  api.clearTutorInk();
  check(!editor.getCurrentPageShapes().some((shape) => shape.meta.author === "tutor"), "Tutor ink was not cleared.");
  check(JSON.stringify(studentInk(editor)) === originalInk && documentPages(editor).length === 2 && editor.getShape(highlightId),
    "Clearing tutor ink changed the student's work.");
  pass("Clearing annotations preserves student ink and PDF pages");

  const undoIds = addLine(editor, 220);
  api.draw({ type: "highlight", target, colour: "green" });
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  editor.undo();
  check(undoIds.every((id) => !editor.getShape(id)) && documentPages(editor).length === 2, "Undo affected the document or missed the new line.");
  check(editor.getCurrentPageShapes().some((shape) => shape.meta.author === "tutor"), "Tutor actions interfered with student undo.");
  pass("Student undo excludes document and tutor operations");

  let finishRead: (lines: string[]) => void = () => {};
  let started: () => void = () => {};
  const startedReading = new Promise<void>((resolve) => { started = resolve; });
  controls.setReader(() => new Promise<string[]>((resolve) => { finishRead = resolve; started(); }));
  const staleLines: string[] = [];
  const off = api.onEvent((event) => { if (event.type === "line") staleLines.push(event.latex); });
  const staleIds = addLine(editor, 330);
  const read = api.readInk().catch(() => []);
  await Promise.race([startedReading, new Promise((_, reject) => setTimeout(() => reject(new Error("Reader didn't start.")), 8000))]);
  await new Promise(requestAnimationFrame);
  check(document.body.textContent?.includes("Reading your writing…"), "Reading has no visible progress feedback.");
  check(api.getEquations().some((line) => line.latex === null), "Pending ink incorrectly shows cached recognition.");
  editor.deleteShapes(staleIds);
  finishRead(["stale result"]);
  await read;
  await new Promise(requestAnimationFrame);
  check(!document.body.textContent?.includes("Reading your writing…"), "Cancelled reading left the progress message visible.");
  off();
  controls.setReader(async () => ["x + C"]);
  check(!staleLines.includes("stale result"), "Erased handwriting produced a late event.");
  pass("Reading feedback clears when erasing cancels a late result");

  const selected = editor.getCurrentPageShapes().filter((shape) => shape.meta.kind === "circle");
  editor.deleteShapes(selected);
  check(api.getLatestCircle() === null, "Deleted circle remained active.");
  pass("Deleting a selection removes stale context");

  let attempts = 0;
  const readsBeforeUnclear = controls.readCount();
  controls.setReader(async () => ++attempts === 1 ? [] : ["after unclear"]);
  addLine(editor, 20);
  await api.readInk();
  check(controls.readCount() === readsBeforeUnclear + 1, "Unclear fixture did not reach the reader.");
  const nextLine = await nextEvent(api, "line", () => { addLine(editor, 440); });
  check(nextLine.latex === "after unclear" && attempts === 2,
    "An unchanged unreadable line blocked or repeated before newer writing.");
  pass("Unreadable old lines do not block newer writing or repeat automatically");

  controls.setReader(async () => ["clarified line"]);
  const callsBeforeRetry = controls.readCount();
  const retried = await api.readInk();
  check(retried.includes("clarified line") && controls.readCount() === callsBeforeRetry + 1,
    "An explicit reread did not retry unclear ink or discarded the good-line cache.");
  pass("An explicit reread retries unclear ink while preserving successful results");

  controls.setReader(async () => ["\\int x^{2} \\quad + C"]);
  await nextEvent(api, "line", () => { addLine(editor, 550); });
  click("Equation layers");
  await new Promise(requestAnimationFrame);
  const formula = [...document.querySelectorAll('[aria-label="Equations"] .katex-html')].find((element) => element.textContent?.includes("∫"));
  check(formula?.textContent?.includes("∫") && formula.querySelector(".msupsub") &&
    formula.querySelector(".mspace") && !formula.textContent.includes("\\"),
    "Integral, superscript or spacing commands appeared as raw LaTeX.");
  pass("Recognised integrals, superscripts and spacing render as math");
  controls.setReader(async () => ["x + C"]);

  const idleStarted = performance.now();
  const idle = await nextEvent(api, "idle", () => { addHighlight(editor); });
  check(idle.ms >= 7900 && performance.now() - idleStarted >= 7900, "Highlighting did not reset the idle timer.");
  pass("Idle waits eight seconds after highlighting as well as writing");

  editor.deleteShapes(studentInk(editor));
  const responses = ["x + C", "y + 1", "\\frac{d}{dx}"];
  let reads = 0;
  controls.setReader(async (image) => {
    const crop = new Image(); crop.src = image; await crop.decode();
    check(crop.width < 400, "A recognition crop combines distant equations.");
    return [responses[reads++]];
  });
  editor.run(() => {
    addLine(editor);
    for (const xOffset of [700, 1400]) for (const id of addLine(editor)) {
      const stroke = editor.getShape(id)!;
      editor.updateShape({ id, type: "draw", x: stroke.x + xOffset });
    }
  });
  const separate = await api.readInk();
  check(reads === 3 && JSON.stringify(separate) === JSON.stringify(responses), "Distant equations were not read separately.");
  await new Promise(requestAnimationFrame);
  check(document.querySelectorAll('[aria-label^="Select equation "]').length === 3, "Equations do not have individual selection controls.");
  pass("Distant equations receive individual crops, results and selection controls");

  const one = await nextEvent(api, "circle", () => click("Select equation 1"));
  check(one.context.recentLines.length === 1 && one.context.recentLines[0] === responses[0],
    "Selecting one equation includes unrelated recognised lines.");
  const range = await nextEvent(api, "circle", () => click("Select equation 3", { shiftKey: true }));
  check(range.context.recentLines.length === 3 && document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 3,
    "Shift-click did not select the range of equation layers.");
  pass("Shift-click selects a range of equation layers");
  const multiple = await nextEvent(api, "circle", () => click("Select equation 2", { ctrlKey: true }));
  check(JSON.stringify(multiple.context.recentLines) === JSON.stringify([responses[0], responses[2]]),
    "Selecting separated equations includes the equation between them.");
  const middle = api.getEquations()[1].bbox;
  const selectionImage = new Image(); selectionImage.src = multiple.context.inkOnlyImage; await selectionImage.decode();
  const canvas = document.createElement("canvas"); canvas.width = selectionImage.width; canvas.height = selectionImage.height;
  const ctx = canvas.getContext("2d")!; ctx.drawImage(selectionImage, 0, 0);
  const scale = canvas.width / multiple.context.bbox.w;
  const pixels = ctx.getImageData(Math.ceil((middle.x - multiple.context.bbox.x) * scale),
    Math.ceil((middle.y - multiple.context.bbox.y) * scale), Math.floor(middle.w * scale), Math.floor(middle.h * scale)).data;
  check(pixels.every((value, i) => i % 4 === 3 || value > 240), "An unselected equation leaked into the selection crop.");
  pass("Single and multiple selections provide only the chosen ink and recognised equations");

  await new Promise(requestAnimationFrame);
  const groupButton = document.querySelector<HTMLButtonElement>('[aria-label="Group equations"]');
  check(groupButton && !groupButton.disabled, "Grouping two chosen equations is unavailable.");
  await nextEvent(api, "circle", () => groupButton.click());
  const block = editor.getSelectedShapes()[0];
  check(block?.type === "group" && block.meta.kind === "equation-block", "Equations did not become a movable block.");
  check(api.getEquations().length === 3, "Grouping a block merged its recognition results.");
  await api.readInk();
  check(reads === 3, "Grouping spent more recognition calls on unchanged ink.");
  pass("A block moves together while preserving individual equations and cached recognition");

  await new Promise(requestAnimationFrame);
  check(document.querySelector('[aria-label="Select block 1"]')?.getAttribute("aria-expanded") === "false", "A new group did not become one collapsed layer.");
  click("Expand group 1");
  await new Promise(requestAnimationFrame);
  check(document.querySelectorAll('[aria-label^="Select equation "]').length === 3, "Expanding the group lost its equation layers.");
  click("Close equation layers");
  await new Promise((resolve) => setTimeout(resolve, 220));
  check(!document.querySelector('[aria-label="Equation layers panel"]'), "The sidebar did not close.");
  click("Equation layers");
  await new Promise(requestAnimationFrame);
  check(document.querySelector('[aria-label="Select block 1"]')?.getAttribute("aria-selected") === "true" && reads === 3,
    "Reopening layers lost selection or repeated recognition.");
  pass("Groups expand and the sidebar reopens without losing selection or spending recognition calls");
  click("Ungroup equations");
  await api.readInk();
  check(!editor.getShape(block.id) && reads === 3, "Ungrouping lost ink or repeated recognition.");
  editor.undo();
  check(editor.getShape(block.id)?.type === "group", "Undo did not restore the equation block.");
  await api.readInk();
  check(reads === 3 && api.getEquations().length === 3, "Undo changed recognition boundaries or discarded its cache.");
  pass("Ungroup and undo preserve the ink, equation boundaries and recognition cache");

  const beforeMove = controls.readCount();
  controls.setReader(async () => ["moved equation"]);
  const restored = editor.getShape(block.id)!;
  const beforeBoxes = api.getEquations();
  editor.markHistoryStoppingPoint("move block fixture");
  editor.updateShape({ id: block.id, type: "group", x: restored.x + 2500, y: restored.y - 900 });
  await api.readInk();
  const movedLines = api.getEquations();
  check(controls.readCount() === beforeMove && movedLines.every((line) => beforeBoxes.some((before) =>
    before.shapeIds.includes(line.shapeIds[0]) && before.latex === line.latex)), "Moving a block repeated recognition or lost cached results.");
  const movedFirst = movedLines.find((line) => line.shapeIds.includes(beforeBoxes[0].shapeIds[0]))!;
  check(Math.abs(movedFirst.bbox.x - beforeBoxes[0].bbox.x - 2500) < 0.001 &&
    Math.abs(movedFirst.bbox.y - beforeBoxes[0].bbox.y + 900) < 0.001, "Cached recognition kept stale canvas bounds.");
  pass("Moving a block any distance preserves recognition and updates its bounds with zero calls");

  editor.selectNone();
  const movedContext = await nextEvent(api, "circle", () => editor.select(block.id));
  check(movedContext.context.recentLines.length === 2 && movedContext.context.bbox.x > beforeBoxes[0].bbox.x + 2400 &&
    controls.readCount() === beforeMove, "Selection after moving lost recognised lines or kept old crop bounds.");
  pass("Moved selections use current bounds and cached LaTeX");

  const sourceIds = beforeBoxes[0].shapeIds;
  const symbolId = sourceIds.toSorted((a, b) => shapeBox(editor, editor.getShape(b as TLShapeId)!).x -
    shapeBox(editor, editor.getShape(a as TLShapeId)!).x)[0] as TLShapeId;
  const symbol = editor.getShape(symbolId)!;
  let changedReads = 0;
  controls.setReader(async () => ["changed " + ++changedReads]);
  editor.markHistoryStoppingPoint("detach symbol fixture");
  editor.updateShape({ id: symbol.id, type: "draw", x: symbol.x + 1200, y: symbol.y + 600 });
  await api.readInk();
  check(changedReads === 2 && api.getEquations().length === 4 &&
    api.getEquations().some((line) => line.shapeIds.length === 1 && line.shapeIds[0] === symbolId),
    "Detaching a symbol kept it pinned to its source or reread unrelated equations.");
  const splitSource = api.getEquations().find((line) => line.shapeIds.some((id) => sourceIds.includes(id) && id !== symbolId))!;
  pass("Detaching a symbol reads only its source and the detached piece");

  const afterSplitCalls = controls.readCount();
  editor.undo();
  await api.readInk();
  check(api.getEquations().length === 3 && api.getEquations().some((line) => line.shapeIds.includes(symbolId) &&
    line.latex === beforeBoxes[0].latex) && controls.readCount() === afterSplitCalls, "Undo did not restore the original equation and cache.");
  editor.redo();
  await api.readInk();
  check(api.getEquations().length === 4 && controls.readCount() === afterSplitCalls, "Redo reread the previously recognised split.");
  editor.undo();
  await api.readInk();
  pass("Undo and redo restore membership and recognised arrangements without calls");

  const destination = api.getEquations().find((line) => line.shapeIds.includes(beforeBoxes[1].shapeIds[0]))!;
  const restoredSymbol = editor.getShape(symbolId)!;
  const symbolBox = shapeBox(editor, restoredSymbol);
  const beforeJoinCalls = controls.readCount();
  editor.markHistoryStoppingPoint("join symbol fixture");
  editor.updateShape({ id: symbolId, type: "draw",
    x: restoredSymbol.x + destination.bbox.x + destination.bbox.w + 15 - symbolBox.x,
    y: restoredSymbol.y + destination.bbox.y - symbolBox.y });
  await api.readInk();
  const joined = api.getEquations().find((line) => line.shapeIds.includes(symbolId))!;
  check(controls.readCount() === beforeJoinCalls + 1 && api.getEquations().some((line) =>
    line.shapeIds.includes(splitSource.shapeIds[0]) && line.latex === splitSource.latex),
    "A transfer should reuse the already-read source and read only its new destination.");
  check(joined.shapeIds.length === destination.shapeIds.length + 1 && destination.shapeIds.every((id) => joined.shapeIds.includes(id)),
    "The transferred symbol did not join its destination: " + JSON.stringify({ joined, destination }));
  check(editor.getShape(symbolId)?.parentId === editor.getShape(destination.shapeIds[0] as TLShapeId)?.parentId,
    "The transferred symbol did not follow its destination layer group.");
  editor.undo();
  await api.readInk();
  check(controls.readCount() === beforeJoinCalls + 1, "Undoing a transfer repeated recognition.");
  pass("A transferred symbol updates only source/destination and follows the destination layer group");

  let resolveMoving: (lines: string[]) => void = () => {};
  let signalDuringMove = new AbortController().signal;
  let startMoving: () => void = () => {};
  const movingStarted = new Promise<void>((resolve) => { startMoving = resolve; });
  controls.setReader((_image, signal) => new Promise<string[]>((resolve) => {
    signalDuringMove = signal; resolveMoving = resolve; startMoving();
  }));
  const flightIds = addLine(editor, 800);
  const beforeFlightCalls = controls.readCount();
  const flightEvents: Extract<CanvasEvent, { type: "line" }>[] = [];
  const stopFlightEvents = api.onEvent((event) => { if (event.type === "line") flightEvents.push(event); });
  const flight = api.readInk();
  await Promise.race([movingStarted, new Promise((_, reject) => setTimeout(() => reject(new Error("Moving reader did not start.")), 8000))]);
  editor.markHistoryStoppingPoint("move during recognition fixture");
  pointing(true);
  editor.run(() => flightIds.forEach((id) => {
    const stroke = editor.getShape(id)!;
    editor.updateShape({ id, type: "draw", x: stroke.x + 3500, y: stroke.y - 2500 });
  }));
  check(!signalDuringMove.aborted, "Translation cancelled an already-running recognition request.");
  resolveMoving(["moved while reading"]);
  await flight;
  pointing(false);
  editor.complete();
  await api.readInk();
  stopFlightEvents();
  const flightLine = api.getEquations().find((line) => line.shapeIds.includes(flightIds[0]))!;
  const flightEvent = flightEvents.find((event) => event.latex === "moved while reading");
  check(controls.readCount() === beforeFlightCalls + 1 && flightLine.latex === "moved while reading" &&
    flightEvent && "bbox" in flightEvent.target && JSON.stringify(flightEvent.target.bbox) === JSON.stringify(flightLine.bbox),
    "Moving during recognition repeated a request or published stale target coordinates.");
  pass("An in-flight recognition survives a whole move and returns current coordinates");

  controls.setReader(async () => ["after drop"]);
  const heldSymbol = editor.getShape(flightIds[4])!;
  const beforeHeldCalls = controls.readCount();
  editor.markHistoryStoppingPoint("held partial drag fixture");
  pointing(true);
  editor.updateShape({ id: heldSymbol.id, type: "draw", x: heldSymbol.x + 1300, y: heldSymbol.y + 600 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await api.readInk().catch(() => []);
  check(controls.readCount() === beforeHeldCalls, "Recognition started before the drag ended.");
  pointing(false);
  editor.complete();
  await api.readInk();
  check(controls.readCount() === beforeHeldCalls + 2, "Dropping a partial selection did not read exactly the changed pieces.");
  pass("No requests start while dragging; changed pieces are read once after dropping");

  editor.deleteShapes(studentInk(editor));
  controls.setReader(async () => ["whole equation"]);
  const unpinned = addLine(editor, 110);
  addLine(editor, 400);
  await api.readInk();
  const beforeNearCalls = controls.readCount();
  editor.markHistoryStoppingPoint("move beside another equation fixture");
  editor.run(() => unpinned.forEach((id) => {
    const stroke = editor.getShape(id)!;
    editor.updateShape({ id, type: "draw", x: stroke.x + 120, y: stroke.y + 290 });
  }));
  await api.readInk();
  check(api.getEquations().length === 2 && controls.readCount() === beforeNearCalls,
    "Moving a whole ungrouped equation near another merged its membership or repeated recognition.");
  pass("Whole ungrouped equations keep their identity even when moved beside another");
  controls.setReader(async () => ["x + C"]);
  focusSample(editor);
}
