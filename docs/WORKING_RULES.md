# Working rules: who touches what

Each of us owns one part (see [AGENT_BRAIN.md §8](AGENT_BRAIN.md)). **You only change files in your own part's folders.** This keeps merge conflicts rare and means nobody breaks someone else's work by accident.

---

## 1. Your branch and your folders

| Part | Branch | You may change | Owner |
|---|---|---|---|
| **A** Canvas eyes and hands | `part-a/canvas` | `src/components/app/` · `src/app/app/` · `src/lib/canvas/` | to assign |
| **B** Agent Brain | `part-b/agent-brain` | `src/lib/agent/` · `src/app/api/tutor/` · `src/app/bench/` | the lead |
| **C** Voice and player | `part-c/voice` | `src/lib/voice/` · `src/lib/player/` · `src/components/voice/` · `src/app/api/voice/` | to assign |
| **D** Math and visuals | `part-d/math-visuals` | `src/lib/math/` · `src/components/visuals/` | to assign |
| **Everyone** | any | `docs/` (notes about your part) · `package.json` + `package-lock.json` (adding a library) | |
| **Lead only** | | everything else: `src/lib/contracts.ts`, landing page, `globals.css`, configs, `.github/`, `CLAUDE.md` | the lead |

The same map lives in [`.github/parts.json`](../.github/parts.json), which the automatic check reads.

You can make extra branches for your part, as long as the name starts with your prefix, e.g. `part-c/barge-in`.

---

## 2. The rules

1. **Work only on your part's branch.** Never commit to `main` or to someone else's branch.
2. **Change only your folders** (table above). Reading any file is fine; editing isn't.
3. **Talk to other parts only through `src/lib/contracts.ts`.** Import its types; don't import another part's internal files. If you need a contract changed, ask the lead.
4. **Need something changed in another part?** Don't change it yourself. Message its owner (or the lead) and say what you need. They make the change in their part.
5. **Adding a library?** Tell the team first. Two people editing `package-lock.json` at once is the most common conflict.
6. **Pull `main` into your branch often:** `git pull origin main`. Then open a pull request when a piece works.
7. **Run the check before pushing:** `node .github/scripts/part-guard.mjs --local`.

### Plugging parts together
A few spots need one part's component inside another's screen (e.g. Part C's mic button on Part A's canvas). The pattern:
- The provider builds it in **their own folder** (e.g. `src/components/voice/MicButton.tsx`).
- The **owner of the screen** adds the one-line import and places it.

---

## 3. What enforces this

| Layer | What it does |
|---|---|
| **part-guard check** ([workflow](../.github/workflows/part-guard.yml)) | Runs on every pull request into `main`. **Fails** if the branch changes files outside its part's folders. Pull requests by the lead skip it. |
| **`cross-part` label** | The only way past a failed check. **Only the lead adds it**, after agreeing to the change. |
| **CODEOWNERS** ([file](../.github/CODEOWNERS)) | Every pull request needs the lead's review before it can merge. |
| **protect-main ruleset** | Blocks direct pushes to `main`. Requires a pull request, the part-guard check and the code owner's review. |
| **AI assistant rules** (`CLAUDE.md`, `AGENTS.md`) | Tell Claude/Copilot/Cursor which folders they may edit for the current branch. |

Note: GitHub can't stop someone *pushing* odd files to their own branch. But nothing reaches `main` unless the check passes and the lead approves.

---

## 4. Lead's one-time GitHub setup

In **Settings → Rules → Rulesets → protect-main**:
1. **Enforcement status: Active**, and **Target: Include default branch**.
2. Tick **Require a pull request before merging**:
   - Required approvals: **1**
   - Tick **Require review from Code Owners**
3. Tick **Require status checks to pass** → Add check **`part-guard`**. It appears in the list after the check has run on one pull request.
4. Tick **Block force pushes** and **Restrict deletions**.
5. **Bypass list:** add **Repository admin** (you), so you can merge your own pull requests. Code owners can't approve their own pull request.
6. Create the label: **Issues → Labels → New label** → `cross-part`.
7. When owners are assigned, put their GitHub usernames in `.github/CODEOWNERS` and in the table above.
