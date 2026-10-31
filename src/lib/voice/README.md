# Part C: Voice and the player

**Branch:** `part-c/voice` · **Owner:** _to assign_ · **Spec:** [AGENT_BRAIN.md §5, §8](../../../docs/AGENT_BRAIN.md), [APPROACH_DRAFT.md §3a, §5](../../../docs/APPROACH_DRAFT.md) · **Rules:** [WORKING_RULES.md](../../../docs/WORKING_RULES.md)

You make ∂raft a **conversation**: the mic, hearing the student, speaking, and making the drawing happen **at the same moment** as the words.

## Your folders (only edit these)

| Folder | What's in it |
|---|---|
| `src/lib/voice/` | Mic capture, Gradium speech-to-text and text-to-speech |
| `src/lib/player/` | The beat player: speaks each beat and fires its visuals in sync ([README](../player/README.md)) |
| `src/components/voice/` | `MicButton` (the only control the student needs) |
| `src/app/api/voice/` | Server route that mints single-use Gradium tokens (key never reaches the browser) |

## Files

| File | Does | Status |
|---|---|---|
| `voice/index.ts` | Public entry for voice | ✅ |
| `voice/mic.ts` | Start/stop the mic; local VAD so only speech is sent | ⬜ stub |
| `voice/stt.ts` | Gradium STT WebSocket (`delay_in_frames` 8–16), end-of-turn detection | ⬜ stub |
| `voice/tts.ts` | Gradium TTS, sentence by sentence; returns when a sentence **starts** and **ends** | ⬜ stub |
| `player/index.ts`, `player/player.ts` | `createPlayer({ canvas, visuals })`: implements `PlayerApi` | ⬜ stub |
| `components/voice/MicButton.tsx` | Mic on/off button with a "Listening" state | 🟡 UI placeholder |
| `app/api/voice/token/route.ts` | `GET /api/voice/token`: single-use Gradium token | ⬜ returns 501 |

## What you give the others (`PlayerApi`)

- `play(turn)`: speak each beat; **when a beat starts**, fire its visuals (`canvas.draw` for highlight/writeStep/mark, `visuals.run` for plot/animateParam/showVisual)
- `stop()`: barge-in: stop audio, drop queued beats
- `onStudentSaid(listener)`: final transcripts, with `duringTurn` = true if the tutor was talking
- `MicButton` from `@/components/voice`, for Part A to place on the canvas

## What you use from others

- `CanvasApi` (Part A) and `VisualsApi` (Part D) to fire visuals. Until ready: `fakeCanvas()`, `fakeVisuals()`
- Turns from the brain. Until ready: `sampleTurn` from `src/lib/fakes.ts`

## Tasks, in order

1. [ ] `/api/voice/token`: call Gradium `GET /api-keys/token` with the server key; return the token
2. [ ] `mic.ts` + `MicButton`: on → capture audio; off → stop and release the mic (D15)
3. [ ] `stt.ts`: stream to Gradium; emit final transcripts; end of turn from semantic VAD (`inactivity_prob`)
4. [ ] `tts.ts`: speak one sentence; resolve "started" and "ended" so the player can sync
5. [ ] `player.ts`: queue beats; on "started" fire visuals; small gap between beats; then wait (`waitFor`)
6. [ ] Instant "Mm, let me look…" while the brain thinks (~300 ms)
7. [ ] Barge-in: student speaks while TTS plays → `stop()` and send `StudentSaid { duringTurn: true }`
8. [ ] Backup voice: browser `speechSynthesis` if Gradium is down
9. [ ] Measure: end of question → first spoken word (target < 3 s)

## Test alone

Play `sampleTurn` with `fakeCanvas()` and `fakeVisuals()`: you should hear each sentence and see the visual logs fire at the start of each one.
