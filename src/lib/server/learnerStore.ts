// Server-only: what ∂raft remembers about each learner, kept in Postgres (db.ts), and the short summary of
// it that goes into every tutor prompt. A learner is one device for now (an id kept in localStorage), until
// real sign-in exists. "Can do" only counts problems the math engine checked, or the tutor judged solved.

import { withDb } from "./db";

export const LEVELS = ["foundation", "developing", "confident", "advanced"] as const;

/** Learner ids come from the browser: accept only our own format. */
export const validLearnerId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9-]{8,64}$/i.test(id);

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const topicOf = (s: unknown) => clean(s, 48).toLowerCase().replace(/[.;:]+$/, "");

type ProblemKey = { learnerId: string; problemId: string; problem?: string };

/** After each tutor turn: the problem's topic, level, hint level, any misconception, and whether it ended solved. */
export async function recordTurn(
  k: ProblemKey,
  t: { topic?: string; level?: string; hintLevel: number; misconception?: string; done: boolean; answer?: "correct" | "wrong" },
) {
  if (!validLearnerId(k.learnerId) || !k.problemId) return;
  const miss = clean(t.misconception, 120);
  const level = LEVELS.includes(t.level as (typeof LEVELS)[number]) ? t.level! : "";
  await withDb(async (db) => {
    await touch(db, k.learnerId);
    await db.query(
      `insert into problems (learner_id, problem_id, problem, topic, level, turns, max_hint, misconceptions, solved, verified, wrong_answers)
       values ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9, $10)
       on conflict (learner_id, problem_id) do update set
         turns = problems.turns + 1,
         problem = case when problems.problem = '' then excluded.problem else problems.problem end,
         topic = case when problems.topic = '' then excluded.topic else problems.topic end,
         level = coalesce(nullif(excluded.level, ''), problems.level),
         max_hint = greatest(problems.max_hint, excluded.max_hint),
         misconceptions = case when cardinality(excluded.misconceptions) = 0
           or excluded.misconceptions[1] = any(problems.misconceptions) then problems.misconceptions
           else problems.misconceptions || excluded.misconceptions end,
         solved = problems.solved or excluded.solved,
         verified = problems.verified or excluded.verified,
         wrong_answers = problems.wrong_answers + excluded.wrong_answers,
         updated_at = now()`,
      [
        k.learnerId, k.problemId, clean(k.problem, 200), topicOf(t.topic), level,
        Math.min(3, Math.max(1, Math.round(t.hintLevel || 1))), miss ? [miss] : [],
        t.done && t.answer !== "wrong", t.answer === "correct" && t.done, t.answer === "wrong" ? 1 : 0,
      ],
    );
  });
}

/** After the engine checks a handwritten line: a right step, a wrong one, or the correct final answer. */
export async function recordLine(k: ProblemKey, verdict: "ok" | "wrong" | "solved") {
  if (!validLearnerId(k.learnerId) || !k.problemId) return;
  await withDb(async (db) => {
    await touch(db, k.learnerId);
    await db.query(
      `insert into problems (learner_id, problem_id, problem, right_lines, wrong_lines, solved, verified)
       values ($1, $2, $3, $4, $5, $6, $6)
       on conflict (learner_id, problem_id) do update set
         problem = case when problems.problem = '' then excluded.problem else problems.problem end,
         right_lines = problems.right_lines + excluded.right_lines,
         wrong_lines = problems.wrong_lines + excluded.wrong_lines,
         solved = problems.solved or excluded.solved,
         verified = problems.verified or excluded.verified,
         updated_at = now()`,
      [k.learnerId, k.problemId, clean(k.problem, 200), verdict === "wrong" ? 0 : 1, verdict === "wrong" ? 1 : 0, verdict === "solved"],
    );
  });
}

export type TopicStat = { topic: string; tried: number; solved: number; verified: number; avgHint: number; wrong: number };
export type Profile = {
  problems: number;
  level: string;
  canDo: TopicStat[];
  working: TopicStat[];
  hard: TopicStat[];
  mistakes: { text: string; times: number }[];
  recent: { problem: string; topic: string; solved: boolean; verified: boolean; maxHint: number }[];
};

export async function loadProfile(learnerId: string): Promise<Profile | null> {
  if (!validLearnerId(learnerId)) return null;
  return withDb(async (db) => {
    const [count, topics, mistakes, recent, levels] = await Promise.all([
      db.query<{ n: string }>(`select count(*) as n from problems where learner_id = $1`, [learnerId]),
      db.query<{ topic: string; tried: string; solved: string; verified: string; avg_hint: string; wrong: string }>(
        `select topic, count(*) as tried, count(*) filter (where solved) as solved, count(*) filter (where verified) as verified,
                avg(max_hint) as avg_hint, sum(wrong_lines + wrong_answers) as wrong
         from problems where learner_id = $1 and topic <> ''
         group by topic order by max(updated_at) desc limit 12`, [learnerId]),
      db.query<{ text: string; times: string }>(
        `select m as text, count(*) as times from problems, unnest(misconceptions) as m
         where learner_id = $1 group by m order by count(*) desc, max(updated_at) desc limit 5`, [learnerId]),
      db.query<{ problem: string; topic: string; solved: boolean; verified: boolean; max_hint: number }>(
        `select problem, topic, solved, verified, max_hint from problems
         where learner_id = $1 and (problem <> '' or topic <> '') order by updated_at desc limit 6`, [learnerId]),
      db.query<{ level: string }>(
        `select level from problems where learner_id = $1 and level <> '' order by updated_at desc limit 8`, [learnerId]),
    ]);
    const stats: TopicStat[] = topics.rows.map((r) => ({
      topic: r.topic, tried: +r.tried, solved: +r.solved, verified: +r.verified, avgHint: +(+r.avg_hint).toFixed(1), wrong: +r.wrong,
    }));
    const isHard = (s: TopicStat) => s.solved === 0 ? s.tried >= 1 && (s.avgHint >= 2 || s.wrong >= 1) : s.avgHint >= 2.5 || s.wrong > s.solved * 2;
    const isStrong = (s: TopicStat) => s.solved >= 1 && s.avgHint <= 2 && s.wrong <= s.solved;
    return {
      problems: +count.rows[0].n,
      level: mode(levels.rows.map((r) => r.level)),
      canDo: stats.filter((s) => isStrong(s) && !isHard(s)),
      hard: stats.filter(isHard),
      working: stats.filter((s) => !isStrong(s) && !isHard(s)),
      mistakes: mistakes.rows.map((r) => ({ text: r.text, times: +r.times })),
      recent: recent.rows.map((r) => ({ problem: r.problem, topic: r.topic, solved: r.solved, verified: r.verified, maxHint: r.max_hint })),
    };
  });
}

/** The profile in a few lines for the prompt (a few hundred tokens at most). */
export function summarizeProfile(p: Profile | null): string {
  if (!p) return "Learner profile: not available (no memory this session). Teach from what you see.";
  if (!p.problems) return "Learner profile: a new learner, no earlier problems. Start at a middle level and find out what they know.";
  const topic = (s: TopicStat) =>
    `${s.topic} (tried ${s.tried}, solved ${s.solved}${s.verified ? `, ${s.verified} checked by the math engine` : ""}, ` +
    `usual hint ${s.avgHint}${s.wrong ? `, ${s.wrong} wrong lines/answers` : ""})`;
  const lines = [`Learner profile (remembered from ${p.problems} earlier problem${p.problems === 1 ? "" : "s"}):`];
  if (p.level) lines.push(`- Level: ${p.level}.`);
  if (p.canDo.length) lines.push(`- Can do: ${p.canDo.map(topic).join("; ")}.`);
  if (p.working.length) lines.push(`- Working on: ${p.working.map(topic).join("; ")}.`);
  if (p.hard.length) lines.push(`- Finds hard: ${p.hard.map(topic).join("; ")}.`);
  if (p.mistakes.length) lines.push(`- Mistakes made before: ${p.mistakes.map((m) => `"${m.text}"${m.times > 1 ? ` ×${m.times}` : ""}`).join("; ")}.`);
  if (p.recent.length) {
    lines.push(`- Recent problems: ${p.recent.map((r) =>
      `"${r.problem.slice(0, 70) || r.topic}"${r.topic && r.problem ? ` (${r.topic})` : ""} ${r.solved ? `solved${r.verified ? " (engine-checked)" : ""} at hint ${r.maxHint}` : "not solved"}`).join("; ")}.`);
  }
  return lines.join("\n");
}

/** "Forget me": deletes the learner and everything about them. */
export async function forgetLearner(learnerId: string): Promise<boolean> {
  if (!validLearnerId(learnerId)) return false;
  return (await withDb(async (db) => (await db.query(`delete from learners where id = $1`, [learnerId]), true))) ?? false;
}

async function touch(db: import("pg").Pool, id: string) {
  await db.query(`insert into learners (id) values ($1) on conflict (id) do update set last_seen = now()`, [id]);
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}
