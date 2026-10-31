# The beat player (Part C)

Owned by **Part C**. Main doc: [src/lib/voice/README.md](../voice/README.md).

Plays a `TutorTurn`: for each beat, **speak the sentence and fire its visuals the moment the sentence starts**. That's what makes ∂raft "talk while drawing" (D21).

```
beat 1: speak("Look at x and eˣ")  ── started ──► canvas.draw(highlight x), canvas.draw(highlight eˣ)
        ── ended ──► short pause
beat 2: speak("Differentiate x…")  ── started ──► canvas.draw(writeStep "x → 1")
...
last beat ended ──► waitFor: "answer" (listen) | "line" (wait for the pen) | "none"
```

| File | Does |
|---|---|
| `index.ts` | Public entry: `createPlayer` |
| `player.ts` | `createPlayer({ canvas, visuals })` → `PlayerApi` |

Routing visuals: `highlight` / `writeStep` / `mark` → `canvas.draw`; `plot` / `animateParam` / `showVisual` → `visuals.run`.
