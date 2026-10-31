# Voice UI (Part C)

Owned by **Part C**. Main doc: [src/lib/voice/README.md](../../lib/voice/README.md).

| File | What it is |
|---|---|
| `index.ts` | Public entry: other parts import `MicButton` from `@/components/voice` |
| `MicButton.tsx` | The mic on/off button (D15). Part A places it on the canvas |

UI work follows the apple-design skill (`.claude/skills/apple-design`): press on touch-down, clear "Listening" state, reduced-motion support.
