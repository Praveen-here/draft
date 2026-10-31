// Server-only: the local Postgres that keeps each learner's profile (DATABASE_URL in .env.local).
// Never import this from client code. Without DATABASE_URL, or with the database down, the tutor still
// works: every call here returns null and the brain teaches without memory.

import { Pool } from "pg";

const SCHEMA = `
create table if not exists learners (
  id text primary key,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create table if not exists problems (
  learner_id text not null references learners(id) on delete cascade,
  problem_id text not null,
  problem text not null default '',
  topic text not null default '',
  level text not null default '',
  turns int not null default 0,
  max_hint int not null default 1,
  wrong_answers int not null default 0,
  right_lines int not null default 0,
  wrong_lines int not null default 0,
  misconceptions text[] not null default '{}',
  solved boolean not null default false,
  verified boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (learner_id, problem_id)
);
create index if not exists problems_recent on problems (learner_id, updated_at desc);
-- A learner's documents. The PDF/image itself is a file under storage/documents/<id>/ (documentStore.ts);
-- canvas = the student's and tutor's shapes, recognised handwriting and camera; chat = the conversation.
create table if not exists documents (
  id text primary key,
  learner_id text not null references learners(id) on delete cascade,
  title text not null,
  kind text not null,
  paper text not null default 'blank',
  file_name text,
  mime text,
  size_bytes int,
  pages int,
  canvas jsonb,
  chat jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz not null default now()
);
create index if not exists documents_recent on documents (learner_id, opened_at desc);
`;

type Shared = { pool: Pool | null; ready: Promise<void> | null; down: number; schema?: string };
// One pool per server process, kept across dev hot reloads.
const shared = ((globalThis as { __draftDb?: Shared }).__draftDb ??= { pool: null, ready: null, down: 0 });

function pool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  shared.pool ??= new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 1500, idleTimeoutMillis: 30000 });
  return shared.pool;
}

/**
 * Run fn with the database, creating the tables on first use. Returns null (and logs once a minute) when
 * there's no database, so callers carry on without memory.
 */
export async function withDb<T>(fn: (db: Pool) => Promise<T>): Promise<T | null> {
  const db = pool();
  if (!db || Date.now() - shared.down < 60000) return null;
  try {
    // Tables are created on first use, and again whenever SCHEMA changes (a dev server keeps this across reloads).
    if (shared.schema !== SCHEMA) { shared.ready = null; shared.schema = SCHEMA; }
    shared.ready ??= db.query(SCHEMA).then(() => undefined, (err) => { shared.ready = null; throw err; });
    await shared.ready;
    return await fn(db);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "";
    const message = err instanceof Error ? err.message : String(err);
    // Can't reach Postgres at all: stop trying for a minute (no slow timeouts on every request).
    // Any other error (one bad query) only fails this call.
    if (/^(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|28P01|28000|3D000)$/.test(code) || /timeout/i.test(message)) {
      shared.down = Date.now();
      console.warn("[db] can't reach the database; memory and saving are off for a minute:", message);
    } else {
      console.warn("[db] query failed:", code, message);
    }
    return null;
  }
}
