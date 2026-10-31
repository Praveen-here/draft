import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../../app/app/read-ink/route";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ0sAAAAASUVORK5CYII=";
const image = "data:image/png;base64," + png;
const envNames = ["APP_ENV", "GEMINI_KEY_DEV", "GEMINI_KEY_DEMO"] as const;
const savedEnv = envNames.map((name) => process.env[name]);
beforeEach(() => {
  process.env.APP_ENV = "dev";
  process.env.GEMINI_KEY_DEV = "fixture-dev-key";
  process.env.GEMINI_KEY_DEMO = "fixture-demo-key";
});
afterEach(() => envNames.forEach((name, i) => {
  if (savedEnv[i] === undefined) delete process.env[name];
  else process.env[name] = savedEnv[i];
}));

const request = (body = JSON.stringify({ image }), headers: HeadersInit = { "content-type": "application/json" }) =>
  new Request("http://localhost/app/read-ink", { method: "POST", headers, body });
const recognised = (lines: unknown = ["x + C"]) => Response.json({ candidates: [{
  finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ lines }) }] },
}] });

test("the reader sends only the ink crop, keeps credentials in the header, and returns validated LaTeX", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(url), "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    assert.equal(new Headers(options?.headers).get("x-goog-api-key"), "fixture-dev-key");
    assert.equal(options?.method, "POST");
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.contents[0].parts, [{ inlineData: { mimeType: "image/png", data: png } }]);
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
    assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "MINIMAL" });
    return recognised(["  x + C  "]);
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { lines: ["x + C"] });
  assert.equal(fetch.mock.callCount(), 1);
});

test("dev and demo credentials never fall back to each other", async (t) => {
  const keys: (string | null)[] = [];
  const fetch = t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, options?: RequestInit) => {
    keys.push(new Headers(options?.headers).get("x-goog-api-key"));
    return recognised();
  });
  delete process.env.APP_ENV;
  assert.equal((await POST(request())).status, 200);
  process.env.APP_ENV = "demo";
  assert.equal((await POST(request())).status, 200);
  delete process.env.GEMINI_KEY_DEMO;
  assert.equal((await POST(request())).status, 503);
  process.env.APP_ENV = "typo";
  assert.equal((await POST(request())).status, 503);
  assert.deepEqual(keys, ["fixture-dev-key", "fixture-demo-key"]);
  assert.equal(fetch.mock.callCount(), 2);
});

test("invalid images and oversized bodies are rejected before any provider call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  const tooWide = Buffer.from(png, "base64");
  tooWide.writeUInt32BE(2048, 16);
  const cases: [Request, number][] = [
    [request("{}", { "content-type": "text/plain" }), 415],
    [request("not json"), 400],
    [request("null"), 400],
    [request(JSON.stringify({ image: "https://example.com/image.png" })), 400],
    [request(JSON.stringify({ image: "data:image/png;base64,ZmFrZQ==" })), 400],
    [request(JSON.stringify({ image: "data:image/png;base64," + tooWide.toString("base64") })), 413],
    [request("{}", { "content-type": "application/json", "content-length": "3000000" }), 413],
    [request(" ".repeat(2 * 1024 * 1024 + 1)), 413],
  ];
  for (const [input, expected] of cases) assert.equal((await POST(input)).status, expected);
  assert.equal(fetch.mock.callCount(), 0);
});

test("quota failures, blocked or malformed replies never fabricate a line or retry", async (t) => {
  let upstream = recognised();
  const fetch = t.mock.method(globalThis, "fetch", async () => upstream);
  const cases: [Response, number][] = [
    [Response.json({ error: "private provider detail" }, { status: 429 }), 429],
    [Response.json({ error: "private provider detail" }, { status: 403 }), 503],
    [Response.json({ error: "private provider detail" }, { status: 500 }), 502],
    [Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] }), 422],
    [Response.json({ promptFeedback: { blockReason: "SAFETY" } }), 422],
    [recognised([]), 422], [recognised(["a", "b"]), 422], [recognised([" "]), 422],
    [Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] }), 422],
    [new Response("not json"), 502],
  ];
  for (const [next, status] of cases) {
    upstream = next;
    const response = await POST(request());
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal("lines" in body, false);
    assert.equal(JSON.stringify(body).includes("private provider detail"), false);
  }
  assert.equal(fetch.mock.callCount(), cases.length);
});

test("network failures and cancelled requests leave credentials private", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("fixture-dev-key"); });
  const response = await POST(request());
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes("fixture-dev-key"), false);
  const cancelled = new Request(request(), { signal: AbortSignal.abort() });
  assert.equal((await POST(cancelled)).status, 408);
  assert.equal(fetch.mock.callCount(), 1);
});

test("the server deadline stops work without a retry", async (t) => {
  t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort(new DOMException("Timed out", "TimeoutError")));
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected provider call"); });
  assert.equal((await POST(request())).status, 504);
  assert.equal(fetch.mock.callCount(), 0);
});
