# Canvas screen (Part A)

Owned by **Part A**. Main doc: [src/lib/canvas/README.md](../../lib/canvas/README.md).

| File | What it is |
|---|---|
| `StartScreen.tsx` | Blank document (pick paper) or open a PDF/image |
| `Canvas.tsx` | tldraw with hidden UI, PDF pages as locked images, top bar |
| `Toolbar.tsx` | Floating glass toolbar: tools, colours, sizes, undo/redo |
| `PaperBackground.tsx` | Blank / lined / grid / dots paper under the canvas |
| `loadPages.ts` | PDF/image → page images (pdf.js) |
| `types.ts`, `icons.tsx` | Shared types and icons for this screen |

UI work follows the apple-design skill (`.claude/skills/apple-design`).
