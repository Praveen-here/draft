# Testing: how to check that things work

Last updated: 1 Nov 2026. Results go in [TEST_RESULTS.md](TEST_RESULTS.md).

## 1. Fast checks (no browser, no keys)

| What | Command | Expect |
|---|---|---|
| Types | `npx tsc --noEmit -p .` | no output |
| Math checker (the lead's engine) | `npx tsx src/lib/math/check.test.ts` | `75/75 passed` (prints every case) |
| Brain: the engine checking handwritten lines (practice sheet) | `npx tsx src/lib/agent/work.test.mts` | `20/20 passed` |
| Brain: ticks, flags, hint offer, typed answers, solved (real engine, mocked Gemini, no database) | `npx tsx src/lib/agent/brain.test.mts` | `18/18 passed` |
| Saved documents (dev server + `DATABASE_URL`) | `curl -X POST localhost:3000/api/documents -H "x-learner-id: test-learner-docs-01" -F "file=@samples/practice-sheet.pdf;type=application/pdf"` then `GET /api/documents` with the same header | a document id; the file in `storage/documents/<id>/`; the list has it. Delete test documents after |
| Learner memory (needs the dev server and `DATABASE_URL`) | `curl "localhost:3000/api/learner?id=test-learner-0001"` | `"memory":true` and a summary |
| Circled text (what counts as inside a circle) | `npx tsx --test src/lib/canvas/tests/textInside.test.ts` | `# pass 4` |
| Tutor stays on maths (calls Gemini: 12 per round) | `node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/brain-scope.mts 2` | `24/24 right` (busy replies are not counted) |
| Part D parser + visuals, Part A canvas geometry + read-ink route | `npx tsx --test src/lib/math/math.test.ts src/components/visuals/visuals.test.ts src/lib/canvas/tests/geometry.test.ts src/lib/canvas/tests/readInkRoute.test.ts` | `# pass 60`, `# fail 0` |
| Folder ownership (part branches only) | `node .github/scripts/part-guard.mjs --local` | fails on lead branches like `integrate/all`; that's expected |

Not re-run since the merge: Part A's browser checks (open `/app/canvas-test`, press the run button), Part D's Playwright suite (`npm run part-d:e2e`, needs Edge), and `npm run build`.

## 2. See it working in a real browser (headless)

The app needs a pen loop and a question to do anything, so a person or a script must draw. `scripts/browser.mjs` drives a headless Chrome over the DevTools protocol (no Playwright needed).

1. Start the app: `npm run dev` (http://localhost:3000). Only one dev server can run per folder; if one is already running, use it.
2. Start a browser once and keep it running (pick the screen size here):
   ```sh
   "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9334 \
     --user-data-dir="$TEMP/draft-chrome" --no-first-run --no-default-browser-check --disable-sync \
     --window-size=1440,900 --autoplay-policy=no-user-gesture-required about:blank
   ```
   Use Chrome, not Edge: Edge with a fresh profile opened a sign-in/sync page instead of the app.
3. Drive it:
   ```sh
   node scripts/browser.mjs open http://localhost:3000/app
   node scripts/browser.mjs upload "C:\\Users\\<you>\\draft\\samples\\practice-sheet.pdf"
   node scripts/browser.mjs circle 590 279 300 30          # loop round Q1 at 1440x900, default zoom
   node scripts/browser.mjs ask "what does a do here?"
   node scripts/browser.mjs wait 15000
   node scripts/browser.mjs shot q1                         # -> <temp>/draft-shots/q1.png
   ```
   Other actions: `drag`, `scrollshot`, `eval` (see the top of the script).

Useful `eval`s (in dev, `window.editor` is tldraw's editor):
- Is the circle recognised? `window.editor.getCurrentPageShapes().filter(s => s.meta.kind === 'circle').length`
- Did a thread open? `document.querySelectorAll('[aria-label="Conversation with ∂raft"]').length`
- Where's the chat handle? `document.querySelector('[data-drag-handle]').getBoundingClientRect()`
- Fit the page to the screen width (what a tablet user would do): `(() => { const e = window.editor; const p = e.getCurrentPageShapes().find(s => s.meta.kind === 'page'); const W = e.getViewportScreenBounds().w; const z = (W - 16) / p.props.w; e.setCamera({ x: -p.x + 8 / z, y: -p.y + 80 / z, z }); })()`
- Where is a printed word on screen? Page shapes keep PDF text boxes in `meta.textItems` (page-local coordinates); convert with `editor.pageToViewport({ x: page.x + item.bbox.x, y: page.y + item.bbox.y })`.

Screen sizes we check: 1440×900 (laptop), 820×1180 (tablet portrait), ~504×800 (headless Chrome's narrowest; phone-like). The DevTools size override resets when each command disconnects, so change size by relaunching the browser with another `--window-size`.

Each question costs one Gemini call (`/api/tutor`, ~2–5 s); handwriting costs one call per line (`/app/read-ink`). Keep runs short on the free tier.

## 3. Windows / shell notes for AI assistants

- The Bash tool is Git Bash. **Heredocs and `python -c` eat backslashes** (`\\int` became `int`, `\b` became a backspace character). Write test files and patch scripts with the file-writing tool, then run them.
- Run TypeScript files with `npx tsx file.ts` (or `npx jiti`). Top-level `await` needs an `.mts` file.
- Very long paths under node_modules can fail to delete from Git Bash ("Filename too long"); PowerShell with a `\\?\` path works.
