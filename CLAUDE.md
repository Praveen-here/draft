# ∂raft

Hackathon project. Project docs live in `docs/`; decisions in `docs/DECISIONS.md`.

**New chat? Read `docs/STATUS.md` first**: what's built, where the code is, what's next. Keep it updated when something big lands.

- For any UI work, use the apple-design skill (`.claude/skills/apple-design`).
- Never print or commit API key values; `.env.local` is git-ignored.

## Who may edit what (read before changing any file)

The work is split into 4 parts, each with its own branch and folders. Full rules: `docs/WORKING_RULES.md`; folder map: `.github/parts.json`.

1. Run `git branch --show-current` first. The prefix tells you the part: `part-a/` Canvas, `part-b/` Agent Brain, `part-c/` Voice and player, `part-d/` Math and visuals.
2. **Only edit files inside that part's folders** (from `.github/parts.json`), plus `docs/` and, when adding a library, `package.json`/`package-lock.json`.
3. Reading any file is fine. **Do not edit files in another part's folders or lead-only files** (`src/lib/contracts.ts`, `src/lib/fakes.ts`, `src/lib/session.ts`, landing page, `globals.css`, configs, `.github/`, `CLAUDE.md`, `AGENTS.md`), even if it would be the quickest fix. Instead, stop and tell the user which file needs changing and why, so they can ask that part's owner.
4. Parts talk only through `src/lib/contracts.ts`. Import only from `@/lib/contracts`, `@/lib/fakes`, or another part's public `index.ts` (e.g. `@/lib/voice`, `@/components/visuals`); never another part's internal files. Each part's guide is the `README.md` in its main folder (`src/lib/canvas`, `src/lib/agent`, `src/lib/voice`, `src/lib/math`).
5. Never commit to `main`. Before pushing, run `node .github/scripts/part-guard.mjs --local`.
6. If the branch isn't a `part-*` branch, ask the user which part they're working on before editing.
