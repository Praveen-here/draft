/**
 * The browser's side of saved documents (server: src/app/api/documents, src/lib/server/documentStore.ts).
 * Documents belong to this device's learner (learnerId) until real sign-in exists. Every call fails soft:
 * without a database the app still works, just without saving (null / false).
 */
import { learnerId } from "@/lib/agent";

export type DocSummary = {
  id: string;
  title: string;
  kind: "blank" | "pdf" | "image";
  paper: string;
  fileName: string | null;
  pages: number | null;
  createdAt: string;
  updatedAt: string;
  openedAt: string;
};
/** The canvas as saved: the student's and tutor's shapes (not the PDF pages), handwriting already read, the view. */
export type SavedCanvas = {
  shapes: unknown[];
  recognised: [string, string][];
  camera?: { x: number; y: number; z: number };
};
export type SavedDoc = DocSummary & { canvas: SavedCanvas | null; chat: unknown[] };
export type DocPatch = { canvas?: SavedCanvas; chat?: unknown[]; paper?: string; title?: string; pages?: number };

const who = (): Record<string, string> => {
  const id = learnerId();
  return id ? { "x-learner-id": id } : {};
};

/** This learner's documents, most recently opened first; null when saving is off. */
export async function listDocs(): Promise<DocSummary[] | null> {
  try {
    const res = await fetch("/api/documents", { headers: who(), cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { documents: DocSummary[] }).documents;
  } catch {
    return null;
  }
}

/** Save a new document (uploading its file, if any). Null when saving is off; throws with a message the student can read. */
export async function createDoc(o: { file?: File; paper: string; title?: string }): Promise<DocSummary | null> {
  let res: Response;
  try {
    if (o.file) {
      const form = new FormData();
      form.set("file", o.file);
      form.set("paper", o.paper);
      if (o.title) form.set("title", o.title);
      res = await fetch("/api/documents", { method: "POST", headers: who(), body: form });
    } else {
      res = await fetch("/api/documents", {
        method: "POST",
        headers: { ...who(), "Content-Type": "application/json" },
        body: JSON.stringify({ paper: o.paper, title: o.title }),
      });
    }
  } catch {
    return null;
  }
  const data = (await res.json().catch(() => ({}))) as { document?: DocSummary; error?: string };
  if (res.status === 503) return null;
  if (!res.ok || !data.document) throw new Error(data.error ?? "Couldn't save this document.");
  return data.document;
}

/** A saved document with its file, ready to open. */
export async function openDoc(id: string): Promise<{ doc: SavedDoc; file: File | null }> {
  const res = await fetch(`/api/documents/${id}`, { headers: who(), cache: "no-store" });
  if (!res.ok) throw new Error("This document couldn't be found.");
  const doc = ((await res.json()) as { document: SavedDoc }).document;
  if (doc.kind === "blank") return { doc, file: null };
  const fileRes = await fetch(`/api/documents/${id}/file`, { headers: who(), cache: "no-store" });
  if (!fileRes.ok) throw new Error("This document's file is missing.");
  const blob = await fileRes.blob();
  return { doc, file: new File([blob], doc.fileName ?? doc.title, { type: blob.type }) };
}

/** Save part of a document. keepalive: for the last save as the page closes (best effort, small bodies only). */
export async function saveDoc(id: string, patch: DocPatch, o: { keepalive?: boolean } = {}): Promise<boolean> {
  try {
    const body = JSON.stringify(patch);
    const res = await fetch(`/api/documents/${id}`, {
      method: o.keepalive ? "POST" : "PUT",
      headers: { ...who(), "Content-Type": "application/json" },
      body,
      keepalive: !!o.keepalive && body.length < 60000,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteDoc(id: string): Promise<boolean> {
  try {
    return (await fetch(`/api/documents/${id}`, { method: "DELETE", headers: who() })).ok;
  } catch {
    return false;
  }
}

/**
 * Save after a pause: schedule() on every change, and the patch from `build` is sent once things are quiet.
 * flush() sends a pending save now (e.g. before leaving the document).
 */
export function autosaver(id: string, build: () => DocPatch, delay = 1500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let running: Promise<boolean> = Promise.resolve(true);
  const listeners = new Set<(state: "saving" | "saved" | "error") => void>();
  const tell = (s: "saving" | "saved" | "error") => listeners.forEach((fn) => fn(s));
  const run = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!pending) return running;
    pending = false;
    tell("saving");
    running = running.then(() => saveDoc(id, build())).then((ok) => {
      tell(ok ? "saved" : "error");
      // Didn't save (server or database away): try again shortly, with whatever is current by then.
      if (!ok && !pending) { pending = true; timer = setTimeout(run, 5000); }
      return ok;
    });
    return running;
  };
  return {
    schedule() {
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    flush: run,
    /** The page is closing: send what's pending without waiting. */
    beacon() {
      if (!pending) return;
      pending = false;
      clearTimeout(timer);
      void saveDoc(id, build(), { keepalive: true });
    },
    onState(fn: (state: "saving" | "saved" | "error") => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
}
export type Autosaver = ReturnType<typeof autosaver>;
