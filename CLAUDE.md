# ∂raft

Hackathon project. Project docs live in `docs/`; decisions in `docs/DECISIONS.md`.

- For any UI work, use the apple-design skill (`.claude/skills/apple-design`).
- Never print or commit API key values; `.env.local` is git-ignored.

## Who may edit what (read before changing any file)

The work is split into 4 parts, each with its own branch and folders. Full rules: `docs/WORKING_RULES.md`; folder map: `.github/parts.json`.

1. Run `git branch --show-current` first. The prefix tells you the part: `part-a/` Canvas, `part-b/` Agent Brain, `part-c/` Voice and player, `part-d/` Math and visuals.
2. **Only edit files inside that part's folders** (from `.github/parts.json`), plus `docs/` and, when adding a library, `package.json`/`package-lock.json`.
3. Reading any file is fine. **Do not edit files in another part's folders or lead-only files** (`src/lib/contracts.ts`, landing page, `globals.css`, configs, `.github/`, `CLAUDE.md`, `AGENTS.md`), even if it would be the quickest fix. Instead, stop and tell the user which file needs changing and why, so they can ask that part's owner.
4. Parts talk only through types in `src/lib/contracts.ts`. Never import another part's internal files.
5. Never commit to `main`. Before pushing, run `node .github/scripts/part-guard.mjs --local`.
6. If the branch isn't a `part-*` branch, ask the user which part they're working on before editing.
