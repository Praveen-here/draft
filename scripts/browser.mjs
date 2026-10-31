// Drive a headless Chrome/Edge over the DevTools protocol, to see the app working without a person.
// See docs/TESTING.md. Start the browser first (one window, kept running between commands), e.g.:
//   chrome --headless=new --remote-debugging-port=9334 --user-data-dir=<temp dir> --no-first-run --disable-sync --window-size=1440,900 about:blank
//
// node scripts/browser.mjs <action> [args...]
//   open <url>                 load a page (waits 5 s)
//   upload <absolute path>     put a file in the page's <input type=file> (e.g. the practice sheet)
//   circle cx cy rx ry         draw a pen loop around a spot (screen px)
//   ask <text...>              type into the ask pill and press Enter
//   drag x1 y1 x2 y2 [steps] [ms]  press, move, release (fast steps = a flick)
//   scrollshot dy name         wheel-scroll, screenshot mid-scroll (name-now) and after (name-settled)
//   shot name                  screenshot to <SHOTS>/name.png
//   eval <js>                  run JS in the page and print the result (window.editor is tldraw's editor in dev)
//   wait ms
// Env: PORT (default 9334), SHOTS (default <os temp>/draft-shots). The window size is the screen size:
// relaunch the browser with another --window-size to test tablet/phone (headless Chrome is at least ~500 px wide).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = process.env.PORT ?? "9334";
const SHOTS = process.env.SHOTS ?? path.join(os.tmpdir(), "draft-shots");
const [, , action, ...args] = process.argv;

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = targets.find((t) => t.type === "page" && (t.url.startsWith("http://localhost") || t.url === "about:blank"));
if (!page) throw new Error("No page tab found: is the browser running with --remote-debugging-port?");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled" || msg.method === "Runtime.exceptionThrown") logs.push(msg);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const r = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(SHOTS, `${name}.png`);
  fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
  console.log("saved", file);
};
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });

await send("Runtime.enable");
await send("Page.enable");

if (action === "open") {
  await send("Page.navigate", { url: args[0] });
  await sleep(5000);
} else if (action === "upload") {
  const doc = await send("DOM.getDocument", { depth: -1 });
  const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: 'input[type="file"]' });
  await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: [args[0]] });
  await sleep(5000);
} else if (action === "shot") {
  await shot(args[0]);
} else if (action === "circle") {
  const [cx, cy, rx, ry] = args.map(Number);
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = -Math.PI / 2 + (i / 64) * Math.PI * 2.08;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  await mouse("mousePressed", ...pts[0]);
  for (const p of pts.slice(1)) {
    await mouse("mouseMoved", ...p);
    await sleep(8);
  }
  await mouse("mouseReleased", ...pts[pts.length - 1]);
  await sleep(1500);
} else if (action === "ask") {
  await evaluate(`document.querySelector('input[aria-label="Ask ∂raft"]').focus()`);
  await send("Input.insertText", { text: args.join(" ") });
  await sleep(200);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
} else if (action === "drag") {
  const [x1, y1, x2, y2, steps = 20, ms = 16] = args.map(Number);
  await mouse("mousePressed", x1, y1);
  for (let i = 1; i <= steps; i++) {
    await mouse("mouseMoved", x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
    await sleep(ms);
  }
  await mouse("mouseReleased", x2, y2);
  await sleep(900);
} else if (action === "scrollshot") {
  const [dy, name] = [Number(args[0]), args[1]];
  for (let i = 0; i < 6; i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 600, y: 400, deltaX: 0, deltaY: dy / 6 });
    await sleep(16);
  }
  await shot(`${name}-now`);
  await sleep(800);
  await shot(`${name}-settled`);
} else if (action === "eval") {
  console.log(JSON.stringify(await evaluate(args.join(" ")), null, 1));
} else if (action === "wait") {
  await sleep(Number(args[0]));
} else {
  console.log("Unknown action. See the comment at the top of scripts/browser.mjs.");
}

await sleep(300);
for (const l of logs) {
  const text = l.params.exceptionDetails
    ? `EXCEPTION ${l.params.exceptionDetails.exception?.description ?? l.params.exceptionDetails.text}`
    : `${l.params.type}: ${l.params.args.map((a) => a.value ?? a.description).join(" ")}`;
  if (!/React DevTools|\[HMR\]|Fast Refresh/.test(text)) console.log(text.slice(0, 400));
}
ws.close();
process.exit(0);
