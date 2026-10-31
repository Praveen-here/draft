// Fails a pull request that changes files outside its part's folders.
// Rules: docs/WORKING_RULES.md. Folder map: .github/parts.json.
//
// Usage (CI): node .github/scripts/part-guard.mjs
//   env HEAD_REF, AUTHOR, OWNER, LABELS (JSON array); changed files from `git diff HEAD~1 HEAD`.
// Usage (local check): node .github/scripts/part-guard.mjs --local
//   compares your branch with origin/main.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(".github/parts.json", "utf8"));
const local = process.argv.includes("--local");

const sh = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const branch = local ? sh("git branch --show-current") : process.env.HEAD_REF ?? "";
const author = process.env.AUTHOR ?? "";
const owner = process.env.OWNER ?? "";
const labels = JSON.parse(process.env.LABELS || "[]");

const files = sh(local ? "git diff --name-only origin/main...HEAD" : "git diff --name-only HEAD~1 HEAD")
  .split("\n")
  .filter(Boolean);

const fail = (msg) => {
  console.error(`\n✗ ${msg}\n\nSee docs/WORKING_RULES.md.`);
  process.exit(1);
};

if (!local && author && author === owner) {
  console.log(`✓ Pull request by the lead (${author}): any files allowed.`);
  process.exit(0);
}
if (labels.includes("cross-part")) {
  console.log("✓ Label 'cross-part' set by the lead: any files allowed.");
  process.exit(0);
}

const match = branch.match(/^part-([a-d])\//);
if (!match) {
  fail(`Branch "${branch}" isn't a part branch. Work on part-a/…, part-b/…, part-c/… or part-d/….`);
}

const part = cfg.parts[match[1]];
const allowed = [...part.paths, ...cfg.shared];
const inside = (f) => allowed.some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p));
const outside = files.filter((f) => !inside(f));

if (outside.length) {
  fail(
    `Part ${match[1].toUpperCase()} (${part.name}) may only change:\n` +
      allowed.map((p) => `  ${p}`).join("\n") +
      `\n\nThis branch also changes:\n` +
      outside.map((f) => `  ${f}`).join("\n") +
      `\n\nUndo those changes, or ask the lead (they can add the 'cross-part' label).`,
  );
}

console.log(`✓ Part ${match[1].toUpperCase()} (${part.name}): all ${files.length} changed files are inside its folders.`);
