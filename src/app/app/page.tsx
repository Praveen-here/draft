"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { StartScreen } from "@/components/app/StartScreen";
import { PAPERS, type DocSource, type Paper } from "@/components/app/types";
import { MotionProvider } from "@/components/landing/motion";
import { createDoc, openDoc } from "@/lib/docs";

// The canvas touches window/pointer APIs, so it only renders in the browser.
const Canvas = dynamic(() => import("@/components/app/Canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white" />,
});

const paperOf = (p: string): Paper => (PAPERS.some((x) => x.id === p) ? (p as Paper) : "blank");

export default function AppPage() {
  const [source, setSource] = useState<DocSource | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** A new document: saved first (file and all), so everything done on it is kept. Without a database it still opens, unsaved. */
  const openNew = async (s: DocSource) => {
    setNotice(null);
    setBusy(s.kind === "file" ? "Saving your document…" : "Starting…");
    try {
      const doc = await createDoc({ file: s.kind === "file" ? s.file : undefined, paper: s.paper });
      setSource(doc ? { ...s, doc: { id: doc.id, title: doc.title } } : s);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't save this document.");
    } finally {
      setBusy(null);
    }
  };

  /** A saved document: its file, ink, chat and view come back as they were. */
  const openSaved = async (id: string) => {
    setNotice(null);
    setBusy("Opening…");
    try {
      const { doc, file } = await openDoc(id);
      const opened = { id: doc.id, title: doc.title, saved: { canvas: doc.canvas, chat: doc.chat } };
      const paper = paperOf(doc.paper);
      setSource(file ? { kind: "file", file, paper, doc: opened } : { kind: "blank", paper, doc: opened });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Couldn't open this document.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <MotionProvider>
      {source ? (
        <Canvas source={source} onExit={() => setSource(null)} />
      ) : (
        <StartScreen onOpen={openNew} onOpenSaved={openSaved} busy={busy} notice={notice} />
      )}
    </MotionProvider>
  );
}
