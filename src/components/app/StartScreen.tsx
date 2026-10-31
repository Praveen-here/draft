"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { deleteDoc, listDocs, type DocSummary } from "@/lib/docs";
import { Logo } from "../landing/Logo";
import { DocIcon, PlusPageIcon, TrashIcon, UploadIcon } from "./icons";
import { PAPERS, type DocSource, type Paper } from "./types";

const spring = { type: "spring" as const, bounce: 0, duration: 0.45 };

const ACCEPT = ".pdf,application/pdf,image/png,image/jpeg,image/webp";

export function StartScreen({ onOpen, onOpenSaved, busy, notice }: {
  onOpen: (source: DocSource) => void;
  /** Reopen a saved document. */
  onOpenSaved?: (id: string) => void;
  /** Saving or opening in progress: what to say while it happens. */
  busy?: string | null;
  /** A problem saving or opening, to show the student. */
  notice?: string | null;
}) {
  const [paper, setPaper] = useState<Paper>("grid");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const take = (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".doc") || name.endsWith(".docx")) {
      setError("Word files aren't supported yet. In Word, use File → Save as PDF, then drop the PDF here.");
      return;
    }
    if (!(file.type === "application/pdf" || name.endsWith(".pdf") || file.type.startsWith("image/"))) {
      setError("That file type isn't supported. Drop a PDF or an image (PNG, JPG).");
      return;
    }
    setError(null);
    onOpen({ kind: "file", file, paper: "blank" });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files[0]);
  };

  return (
    <div className="min-h-dvh bg-paper-2">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="pressable rounded-lg" aria-label="∂raft home">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-8 sm:pt-16">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <h1 className="t-h2">What are we working on?</h1>
          <p className="t-lede mt-3 text-muted">Start on fresh paper, or bring the homework you already have.</p>
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {/* Blank document */}
          <motion.section
            className="surface flex flex-col overflow-hidden rounded-[22px]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 }}
          >
            <button
              type="button"
              onClick={() => onOpen({ kind: "blank", paper })}
              className="group pressable relative block h-56 overflow-hidden border-b border-line text-left"
              aria-label={`New blank document on ${paper} paper`}
            >
              <PaperPreview paper={paper} />
              <span className="absolute left-6 top-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06),0_6px_16px_-6px_rgba(37,71,208,0.35)] ring-1 ring-black/5">
                <PlusPageIcon className="h-6 w-6" />
              </span>
            </button>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="t-h3">Blank document</h2>
              <p className="mt-1.5 text-[0.95rem] leading-[1.55] text-muted">
                Write and work things out by hand, like a fresh notebook page.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Paper style">
                {PAPERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={paper === p.id}
                    onClick={() => setPaper(p.id)}
                    className={`pressable relative rounded-full px-3.5 py-1.5 text-[0.85rem] font-semibold transition-colors duration-200 ${
                      paper === p.id ? "text-ink" : "text-muted hover:text-text"
                    }`}
                  >
                    {paper === p.id && (
                      <motion.span layoutId="start-paper" className="absolute inset-0 rounded-full bg-ink-wash" transition={spring} />
                    )}
                    <span className="relative">{p.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onOpen({ kind: "blank", paper })}
                className="pressable btn-primary mt-6 self-start rounded-full px-5 py-2.5 text-[0.92rem] font-semibold"
              >
                Start writing
              </button>
            </div>
          </motion.section>

          {/* Open a PDF */}
          <motion.section
            className="surface flex flex-col overflow-hidden rounded-[22px]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.1 }}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className="relative h-56 border-b border-line p-4"
            >
              <button
                type="button"
                onClick={() => input.current?.click()}
                className={`pressable flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-[1.5px] border-dashed transition-colors duration-200 ${
                  dragging ? "border-ink bg-ink-wash" : "border-black/15 bg-paper-2 hover:border-ink/40"
                }`}
              >
                <motion.span
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/5"
                  animate={{ y: dragging ? -4 : 0, scale: dragging ? 1.06 : 1 }}
                  transition={spring}
                >
                  <UploadIcon className="h-6 w-6" />
                </motion.span>
                <span className="text-[0.95rem] font-semibold text-text">
                  {dragging ? "Drop to open" : "Drop your PDF here"}
                </span>
                <span className="t-small text-subtle">or tap to choose a file</span>
              </button>
              <input
                ref={input}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  take(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="t-h3">Open a PDF</h2>
              <p className="mt-1.5 text-[0.95rem] leading-[1.55] text-muted">
                Bring your homework, notes or worksheet and write right on top of it.
              </p>
              <p className="t-small mt-5 text-subtle">PDF, PNG or JPG · Word files: save as PDF first</p>

              <AnimatePresence>
                {(error ?? notice) && (
                  <motion.p
                    role="alert"
                    className="mt-4 rounded-xl bg-[#fdecec] px-3.5 py-2.5 text-[0.88rem] leading-[1.45] text-[#b42318]"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={spring}
                  >
                    {error ?? notice}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        </div>

        {onOpenSaved && <Recent onOpen={onOpenSaved} />}
      </main>

      <AnimatePresence>
        {busy && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="status"
          >
            <div className="surface flex items-center gap-3 rounded-2xl px-6 py-4">
              <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-ink/20 border-t-ink" />
              <span className="text-[0.95rem] font-medium text-text">{busy}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The student's saved documents, most recently opened first: tap to carry on where they left off. */
function Recent({ onOpen }: { onOpen: (id: string) => void }) {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  useEffect(() => {
    let live = true;
    void listDocs().then((d) => { if (live) setDocs(d); });
    return () => { live = false; };
  }, []);
  if (!docs?.length) return null;

  const remove = async (doc: DocSummary) => {
    if (!window.confirm(`Delete "${doc.title}"? Its writing and conversation will be gone too.`)) return;
    if (await deleteDoc(doc.id)) setDocs((d) => d?.filter((x) => x.id !== doc.id) ?? null);
  };

  return (
    <motion.section
      className="mt-12"
      aria-labelledby="recent-heading"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.15 }}
    >
      <h2 id="recent-heading" className="t-h3">Recent</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {docs.map((doc) => (
            <motion.li
              key={doc.id}
              layout
              className="surface group relative overflow-hidden rounded-[18px]"
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring}
            >
              <button
                type="button"
                onClick={() => onOpen(doc.id)}
                className="pressable flex w-full items-center gap-3.5 p-4 pr-12 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-wash text-ink">
                  {doc.kind === "blank" ? <PlusPageIcon className="h-5 w-5" /> : <DocIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.98rem] font-semibold text-text">{doc.title}</span>
                  <span className="t-small mt-0.5 block truncate text-subtle">
                    {doc.kind === "pdf" ? "PDF" : doc.kind === "image" ? "Image" : "Notebook"}
                    {doc.pages && doc.kind === "pdf" ? ` · ${doc.pages} page${doc.pages === 1 ? "" : "s"}` : ""}
                    {" · "}{ago(doc.updatedAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void remove(doc)}
                aria-label={`Delete ${doc.title}`}
                className="app-press absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-subtle opacity-70 transition-opacity hover:bg-black/5 hover:text-[#b42318] hover:opacity-100 focus-visible:opacity-100"
              >
                <TrashIcon className="h-[18px] w-[18px]" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

/** "Edited just now", "Edited 5 min ago", "Edited 3 Nov". */
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Edited just now";
  if (s < 3600) return `Edited ${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `Edited ${Math.floor(s / 3600)} h ago`;
  return `Edited ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/** A small live sample of the chosen paper, with a line of handwriting on it. */
function PaperPreview({ paper }: { paper: Paper }) {
  const line = "rgba(60,60,67,0.13)";
  const bg: Record<Paper, string> = {
    blank: "none",
    lined: `linear-gradient(to bottom, transparent calc(100% - 1px), ${line} calc(100% - 1px))`,
    grid: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
    dots: "radial-gradient(circle, rgba(60,60,67,0.28) 1px, transparent 1.6px)",
  };
  const size: Record<Paper, string> = { blank: "auto", lined: "100% 30px", grid: "24px 24px", dots: "22px 22px" };

  return (
    <motion.div
      key={paper}
      className="absolute inset-0 bg-white"
      style={{ backgroundImage: bg[paper], backgroundSize: size[paper] }}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <span className="hand absolute bottom-7 left-6 text-[1.7rem] font-semibold">
        x<sup>2</sup> + 6x + 5 = 0
      </span>
    </motion.div>
  );
}
