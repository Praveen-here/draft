# Part A handoff

Local implementation on **part-a/canvas**, updated 1 November 2026. The user confirmed the
updated branch scope, including student handwriting and handwriting-to-LaTeX.
Target remains **20 hours for the project and ₹0 additional spending**.

**Status: the documented Part A implementation is complete for the local laptop/trackpad
demo.** The user confirmed Gemini development billing is disabled and that laptops
are the intended demo devices. A tablet is not required for this scope.

## Original branch checklist

- [x] Create, expose and dispose CanvasApi with the canvas editor.
- [x] Watch completed strokes and tag student circles versus writing.
- [x] Detect circles around content, including individual terms of longer PDF lines.
- [x] Return selected context, document/ink crops, PDF text and nearby recognised lines.
- [x] Group handwriting and emit recognised lines after a pause, with a live server reader.
- [x] Emit idle events after pen/highlighter activity stops.
- [x] Draw tutor highlights, animated equations, ticks, crosses and circles.
- [x] Mount, replace and remove React visuals without covering the student's work.
- [x] Preserve PDF text items and coordinates alongside rendered pages.

## What is ready

The existing viewer is connected to the canvas API. It detects circles, retains
PDF text, exports selected-context and ink-only crops, groups writing into lines,
emits canvas events, draws tutor annotations and hosts graph components. Its
server-side Gemini reader transcribes grouped ink into LaTeX. Student undo and
clearing tutor notes preserve the locked document.

See the [canvas guide](../src/lib/canvas/README.md) for signatures and commands.

## What teammates need to connect

| Owner | Handoff |
|---|---|
| Lead / Part B | Receive CanvasApi through Canvas.onReady and connect the session. Part A owns the working /app/read-ink transport; use CanvasApi.readInk and line events. A recogniseInk callback can override transport for testing without changing shared contracts. |
| Part C | Supply real microphone on/onToggle state to Canvas.voice. Use canvas.draw for beat visuals. The current button is a placeholder; actual audio capture, playback and timing stay in Part C. |
| Part D | Pass real graph components to mountVisual; same ID replaces, unmountVisual removes. The host is 360 × 260 canvas units. Tutor-mark colours do not constitute a math correctness check. |

Until the parts are connected, /app/canvas-test demonstrates the canvas using explicit
recognition, voice and graph stubs. The normal app uses the Gemini reader and never
invents teaching, math success or recognition results. Provider keys remain server-side
and were not printed or changed. Unit/browser regression suites use mocked recognition;
separate live checks now verify the real provider path. Open **/app** for real handwriting
recognition; **/app/canvas-test** intentionally continues to use fixtures.

The reader uses `gemini-3.5-flash-lite` with minimal thinking, verified through live
generation. Listing a model alone was insufficient: Gemini 2.5 Flash was listed but
generation returned 404 for new users. Existing
`APP_ENV` and `GEMINI_KEY_DEV` / `GEMINI_KEY_DEMO` names are unchanged. Keep billing
disabled on the project's Gemini account for the ₹0 requirement. There are no automatic
retries or paid fallbacks; quota exhaustion is shown in the canvas without losing ink.

## Validation

- 27 Node unit checks: loop geometry, line grouping, slanted writing, placement, recognition validation,
  server transport, separate dev/demo credentials, body/image limits, quota/error handling,
  cancellation and deadlines.
- 36 browser checks: actual PDF rendering/text positions including rotation, individual-term selection,
  separate PNG crops, grouped lines, caching, edits within unchanged bounds, tutor actions,
  graph lifecycle, clearing/undo preservation, reading feedback and late-result cancellation,
  unreadable-line recovery, student highlights, deleting selections, Layers range selection,
  group expansion/sidebar reopening, movement without recognition calls, partial transfers,
  cached undo/redo, in-flight moves and the eight-second idle event.
- Production build and TypeScript check passed.
- Visual review of the tutor equation and drawing controls in the desktop browser.
- Normal upload/pointer/keyboard flow checked, including a simulated quota response;
  production test-page restriction verified (404).
- Native Chrome desktop input → actual canvas PNG → live Gemini → displayed LaTeX passed.
  Circling that writing reused recognition rather than issuing another provider request.
- Controlled live samples: `X + C`, a superscript, and `2 + 2 = 5` were transcribed;
  the deliberate math error was preserved. A blank image returned 422 instead of an invented line.
  Observed request times were about 1.5–2.2 seconds for the smaller checks and 11.7 seconds
  for the first full desktop-flow check. Reading progress is visible while waiting.
- Integral-display regression: one live request for the user's screenshot returned
  `\int x^{2}` correctly. The equation panel renders LaTeX with KaTeX, including integral,
  exponent and spacing commands. Edited ink no longer displays a stale cached result.
- Distant-equation regression: the later screenshot's integral and derivative stay
  separate, with the derivative's numerator, bar and denominator kept together.
  Neighbour-based grouping replaces the expanding line box. Selection provides exact
  chosen ink, excluding an unselected equation between two selected ones. Native blocks
  preserve equation boundaries, cached recognition, ungroup and undo. Block movement
  now reuses recognition at its new coordinates. These checks used fixtures and **zero live provider calls**.
- Native mouse drawing of the integral and distant derivative also produces exactly two
  crops. A smaller superscript regression was fixed during this check. Real pointer clicks
  and Enter select equations and create blocks; selection/grouping added no recognition
  requests. This UI check mocked the provider response and used no live quota.
- Slanted `a+b` / `c+b` regression: local baseline estimation keeps each complete row
  in its own crop. Tests include scaled/translated geometry, reversed stroke order and
  actual smoothed mouse-stroke bounds. Native mouse drawing produced two crops, visually
  checked to contain only `a+b` and `c+b` respectively. Provider responses were mocked;
  this verifies cropping, not live transcription accuracy.
- The Layers sidebar supports Shift-click ranges, Ctrl/⌘-click toggles, collapsible
  groups, keyboard navigation, ungroup and undo. Native keyboard checks confirm arrows
  cannot move ink while navigating layers. Selection/grouping reuse cached recognition.
  The native integral/fraction check passed after these changes; **zero live provider calls**
  were used for the Layers update.
- Movement/cache regression: whole equations and blocks preserve their recognition at any
  position, including moves beside other equations. A pending request survives translation
  and publishes current target bounds. Partial moves update membership after dropping;
  only changed, uncached source/destination pieces are read. A previously read source
  fragment was reused when testing a transfer, leaving just one new destination request.
  Undo/redo restore equation membership and use the bounded cache of 128 recent arrangements.
  No new requests start while the pointer is held down. All 22 Node and 32 browser checks
  passed, plus native Chrome mouse drags of an equation, its group and undo, with **zero
  extra recognition requests**. Provider replies were mocked; this update used no live quota.
- Small-move and row-separation regression: normal spacing changes preserve an equation,
  while distant pieces split and retain their origin so they can reconnect when returned.
  Returning to the original arrangement, undo and redo reuse the recognition cache;
  moving automatic split pieces together also preserves it. Close rows stay separate
  despite tall letters and plus signs; a plus arm cannot masquerade as a fraction bar
  or a superscript on another row. All 27 Node and 36 browser checks passed. Native mouse
  input verified the small move, distant split, return and undo/redo, with no calls on
  return/undo/redo. These checks mocked recognition and used **zero live provider calls**.

Browser recognition checks use a fixture reader; server tests mock Gemini. Graph tests
verify the host, not Part D's plotting or math engine. The development test page is
unavailable in production.

## Limits to settle before judging

- If a tablet becomes available, check circle closure/size and line grouping on that hardware.
  Small loops under 24 canvas units remain writing. Scanned PDFs/images use image
  overlap when there are no printed-text boxes.
- Practise with the team's own trackpad handwriting and check remaining free quota before judging.
  Controlled live checks establish the integration, not universal handwriting accuracy.
  Automatic equation boundaries use stroke geometry; tightly overlapping writing
  still needs calibration with the team's samples.
  Splits made before automatic origins were introduced cannot infer their old parent;
  undo that old split or draw fresh ink to test reconnection without reloading the session.
  There is no per-stroke provider request; settled lines are cached and cancelled
  when their ink changes. Cached history is limited to 128 recent arrangements; an evicted
  arrangement needs recognition again.
- Tune the 1.2-second writing pause and 8-second idle threshold with the brain owner.
- Document loading currently permits 20 MB and 20 PDF pages; very tall rendered pages
  are rejected to limit browser memory.
- Writing remains session-only, as in the existing viewer; reloading loses the document.
- The local HTTP laptop demo works with the installed SDK's development mode. A public HTTPS
  deployment would separately need a genuinely free tldraw licensing option.
  No license, paid plan, billing activation or trial was purchased.

Provider references: [Flash-Lite model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite),
[thinking levels](https://ai.google.dev/gemini-api/docs/thinking),
[free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing).

## Dependencies and ownership

Added the MIT-licensed KaTeX renderer, pinned in the package files, for tutor equations.
Coordinate those two shared dependency files when merging Part D's work.
Code changes stay in the three Part A folders. Shared contracts, fakes, session wiring,
other teams' code, global CSS, root configuration and credentials remain untouched.
