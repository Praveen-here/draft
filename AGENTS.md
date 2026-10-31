<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

**New chat? Read `docs/STATUS.md` first**: what's built, where the code is, what's next.

## Who may edit what (all AI assistants)

This repo is split into 4 parts with their own branches and folders. Before editing, check `git branch --show-current` and only edit files in that part's folders as listed in `.github/parts.json` (plus `docs/`, and `package.json`/`package-lock.json` when adding a library). Never edit another part's folders or lead-only files; tell the user what needs changing instead. Full rules: `docs/WORKING_RULES.md`.
