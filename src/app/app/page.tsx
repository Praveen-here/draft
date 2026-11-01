"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { StartScreen } from "@/components/app/StartScreen";
import { PAPERS, type DocSource, type Paper } from "@/components/app/types";
import { MotionProvider } from "@/components/landing/motion";
import Link from "next/link";
import { GoogleButton } from "@/components/landing/GoogleButton";
import { Logo } from "@/components/landing/Logo";
import { useAccount } from "@/lib/account";
import { createDoc, openDoc } from "@/lib/docs";

// The canvas touches window/pointer APIs, so it only renders in the browser.
const Canvas = dynamic(() => import("@/components/app/Canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white" />,
});

const paperOf = (p: string): Paper => (PAPERS.some((x) => x.id === p) ? (p as Paper) : "blank");

/** While developing, the app can also be used signed out (on this device's id), e.g. by test scripts. */
const DEV = process.env.NODE_ENV === "development";

export default function AppPage() {
  const { account, checking } = useAccount();
  const [devGuest, setDevGuest] = useState(false);
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
      {checking ? (
        <div className="fixed inset-0 bg-paper-2" />
      ) : !account && !devGuest ? (
        <SignIn onGuest={DEV ? () => setDevGuest(true) : undefined} />
      ) : source ? (
        <Canvas source={source} onExit={() => setSource(null)} />
      ) : (
        <StartScreen onOpen={openNew} onOpenSaved={openSaved} busy={busy} notice={notice} account={account} />
      )}
    </MotionProvider>
  );
}

/** Signed out: everything is kept per account, so sign in first. */
function SignIn({ onGuest }: { onGuest?: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper-2 px-5">
      <div className="surface flex w-full max-w-sm flex-col items-center rounded-[24px] px-8 py-10 text-center">
        <Link href="/" className="pressable rounded-lg" aria-label="∂raft home">
          <Logo />
        </Link>
        <h1 className="t-h3 mt-6">Sign in to keep your work</h1>
        <p className="mt-2 text-[0.95rem] leading-[1.55] text-muted">
          Your documents, your conversations with ∂raft and what it learns about how you study are saved to your account.
        </p>
        <GoogleButton className="mt-7 w-full" />
        {onGuest && (
          <button type="button" onClick={onGuest} className="pressable t-small mt-4 text-subtle underline underline-offset-2">
            Continue without signing in (development only)
          </button>
        )}
      </div>
    </div>
  );
}
