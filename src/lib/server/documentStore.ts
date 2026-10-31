// Server-only: a learner's documents. Details, canvas and chat live in Postgres (db.ts); the uploaded PDF or
// image is a file in this project's storage/documents/<id>/ folder (git-ignored). One learner = one device
// for now (validLearnerId), until real sign-in exists.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { withDb } from "./db";
import { validLearnerId } from "./learnerStore";

export const STORAGE_DIR = path.join(process.cwd(), "storage", "documents");
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const KINDS = ["blank", "pdf", "image"] as const;
const PAPERS = ["blank", "lined", "grid", "dots"] as const;
/** Saved canvas + chat for one document; generous, but stops a runaway client from filling the disk. */
const MAX_STATE_BYTES = 15 * 1024 * 1024;

export type DocKind = (typeof KINDS)[number];
export type DocSummary = {
  id: string; title: string; kind: DocKind; paper: string; fileName: string | null; pages: number | null;
  createdAt: string; updatedAt: string; openedAt: string;
};
export type DocFull = DocSummary & { canvas: unknown; chat: unknown[] };

export const validDocId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const paperOf = (p: unknown) => (PAPERS.includes(p as (typeof PAPERS)[number]) ? (p as string) : "blank");

/** The stored file's path: the folder is named by the id, and the name is ours, never the user's. */
function filePath(id: string, mime: string | null) {
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return path.join(STORAGE_DIR, id, `original.${ext}`);
}

type Row = {
  id: string; title: string; kind: DocKind; paper: string; file_name: string | null; pages: number | null;
  created_at: Date; updated_at: Date; opened_at: Date; canvas?: unknown; chat?: unknown[];
};
const summary = (r: Row): DocSummary => ({
  id: r.id, title: r.title, kind: r.kind, paper: r.paper, fileName: r.file_name, pages: r.pages,
  createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(), openedAt: r.opened_at.toISOString(),
});

/** A new document; with a file, the file is written first so a row never points at nothing. Null = no database. */
export async function createDocument(learnerId: string, o: {
  title?: string; paper?: string; file?: { bytes: Buffer; name: string; mime: string };
}): Promise<DocSummary | null> {
  if (!validLearnerId(learnerId)) throw new Error("Unknown learner.");
  const id = randomUUID();
  const file = o.file;
  if (file && file.bytes.length > MAX_FILE_BYTES) throw new Error("Please choose a document smaller than 20 MB.");
  const kind: DocKind = !file ? "blank" : file.mime === "application/pdf" ? "pdf" : "image";
  const title = clean(o.title, 120) || (file ? clean(file.name.replace(/\.[^.]+$/, ""), 120) : "") || "Untitled";
  const created = await withDb(async (db) => {
    if (file) {
      await mkdir(path.join(STORAGE_DIR, id), { recursive: true });
      await writeFile(filePath(id, file.mime), file.bytes);
    }
    await db.query(`insert into learners (id) values ($1) on conflict (id) do update set last_seen = now()`, [learnerId]);
    const { rows } = await db.query<Row>(
      `insert into documents (id, learner_id, title, kind, paper, file_name, mime, size_bytes)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, title, kind, paper, file_name, pages, created_at, updated_at, opened_at`,
      [id, learnerId, title, kind, paperOf(o.paper), file ? clean(file.name, 200) : null, file?.mime ?? null, file?.bytes.length ?? null],
    );
    return summary(rows[0]);
  });
  if (!created && file) await rm(path.join(STORAGE_DIR, id), { recursive: true, force: true }).catch(() => {});
  return created;
}

/** Most recently opened first. */
export async function listDocuments(learnerId: string): Promise<DocSummary[] | null> {
  if (!validLearnerId(learnerId)) return [];
  return withDb(async (db) => {
    const { rows } = await db.query<Row>(
      `select id, title, kind, paper, file_name, pages, created_at, updated_at, opened_at
       from documents where learner_id = $1 order by opened_at desc limit 100`, [learnerId]);
    return rows.map(summary);
  });
}

/** Everything needed to reopen a document (marks it as just opened). */
export async function getDocument(learnerId: string, id: string): Promise<DocFull | null> {
  if (!validLearnerId(learnerId) || !validDocId(id)) return null;
  return withDb(async (db) => {
    const { rows } = await db.query<Row>(
      `update documents set opened_at = now() where id = $1 and learner_id = $2
       returning id, title, kind, paper, file_name, pages, created_at, updated_at, opened_at, canvas, chat`, [id, learnerId]);
    return rows[0] ? { ...summary(rows[0]), canvas: rows[0].canvas ?? null, chat: rows[0].chat ?? [] } : null;
  });
}

/** Save what changed: the canvas, the chat, the paper, the title or the page count. */
export async function updateDocument(learnerId: string, id: string, patch: {
  canvas?: unknown; chat?: unknown; paper?: string; title?: string; pages?: number;
}): Promise<boolean> {
  if (!validLearnerId(learnerId) || !validDocId(id)) return false;
  const canvas = patch.canvas === undefined ? null : JSON.stringify(patch.canvas);
  const chat = Array.isArray(patch.chat) ? JSON.stringify(patch.chat) : null;
  if ((canvas?.length ?? 0) + (chat?.length ?? 0) > MAX_STATE_BYTES) throw new Error("This document is too large to save.");
  const result = await withDb(async (db) => {
    const { rowCount } = await db.query(
      `update documents set
         canvas = coalesce($3::jsonb, canvas),
         chat = coalesce($4::jsonb, chat),
         paper = coalesce($5, paper),
         title = coalesce(nullif($6, ''), title),
         pages = coalesce($7, pages),
         updated_at = now()
       where id = $1 and learner_id = $2`,
      [id, learnerId, canvas, chat, patch.paper === undefined ? null : paperOf(patch.paper),
        patch.title === undefined ? null : clean(patch.title, 120),
        Number.isInteger(patch.pages) && patch.pages! > 0 ? patch.pages : null],
    );
    return (rowCount ?? 0) > 0;
  });
  return result ?? false;
}

/** The uploaded file, if this learner owns the document. */
export async function readDocumentFile(learnerId: string, id: string): Promise<{ bytes: Buffer; mime: string; name: string } | null> {
  if (!validLearnerId(learnerId) || !validDocId(id)) return null;
  const row = await withDb(async (db) =>
    (await db.query<{ mime: string | null; file_name: string | null }>(
      `select mime, file_name from documents where id = $1 and learner_id = $2`, [id, learnerId])).rows[0]);
  if (!row?.mime) return null;
  const bytes = await readFile(filePath(id, row.mime)).catch(() => null);
  return bytes ? { bytes, mime: row.mime, name: row.file_name ?? "document" } : null;
}

/** Delete the document, its saved canvas and chat, and its file. */
export async function deleteDocument(learnerId: string, id: string): Promise<boolean> {
  if (!validLearnerId(learnerId) || !validDocId(id)) return false;
  const deleted = await withDb(async (db) =>
    ((await db.query(`delete from documents where id = $1 and learner_id = $2`, [id, learnerId])).rowCount ?? 0) > 0);
  if (deleted) await rm(path.join(STORAGE_DIR, id), { recursive: true, force: true }).catch(() => {});
  return deleted ?? false;
}
