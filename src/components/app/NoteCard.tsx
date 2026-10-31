"use client";

import type { Note, NoteKind } from "@/lib/contracts";

/** Colour, label and glyph for each kind of explain card. Shared with the numbered marks on the page. */
export const NOTE_TONE: Record<NoteKind, { colour: string; wash: string; label: string; glyph: string }> = {
  variable: { colour: "#2547d0", wash: "#eef2fd", label: "Variable", glyph: "x" },
  number: { colour: "#168a52", wash: "#e8f6ee", label: "Number", glyph: "#" },
  rule: { colour: "#6e4bd8", wash: "#f1edfd", label: "Rule", glyph: "ƒ" },
  mistake: { colour: "#d4452f", wash: "#fdeeeb", label: "Check this", glyph: "!" },
};

/**
 * An explain card: one letter, number or rule from the problem, in plain words. Part A (canvas).
 * number: the badge shown on its term on the page (absent when the card doesn't point at a term).
 */
export function NoteCard({ note, number }: { note: Note; number?: number }) {
  const tone = NOTE_TONE[note.kind] ?? NOTE_TONE.variable;
  return (
    <article
      aria-label={`${tone.label}: ${note.title}`}
      className="flex gap-3 rounded-[20px] bg-white p-3.5 pr-4 shadow-[0_0_0_0.5px_rgba(15,23,42,0.09),0_2px_4px_rgba(16,24,40,0.04),0_14px_34px_-14px_rgba(23,37,110,0.26)]"
    >
      {number !== undefined ? (
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.9rem] font-bold text-white"
          style={{ background: tone.colour, fontVariantNumeric: "tabular-nums", boxShadow: `0 4px 10px -4px ${tone.colour}` }}
        >
          {number}
        </span>
      ) : (
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.95rem] font-semibold italic"
          style={{ background: tone.wash, color: tone.colour, fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
        >
          {tone.glyph}
        </span>
      )}
      <div className="min-w-0 flex-1 pt-px">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.07em]" style={{ color: tone.colour }}>
          {tone.label}
        </p>
        <p className="mt-0.5 text-[1.12rem] font-semibold leading-[1.25] tracking-[-0.015em] text-text" style={{ fontVariantNumeric: "tabular-nums" }}>
          {note.title}
        </p>
        {note.text && <p className="mt-1 text-[0.9rem] leading-[1.45] text-muted">{note.text}</p>}
      </div>
    </article>
  );
}

/** A line the tutor writes, in its handwriting, revealed left to right like a pen stroke. */
export function StepCard({ text, reduce }: { text: string; reduce: boolean }) {
  return (
    <div className="rounded-[20px] bg-white px-4 pb-3 pt-2.5 shadow-[0_0_0_0.5px_rgba(15,23,42,0.09),0_14px_34px_-14px_rgba(23,37,110,0.26)]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-subtle">One step</p>
      <p
        className="hand mt-0.5 text-[1.75rem] leading-[1.15]"
        style={reduce ? undefined : { animation: "draft-write 900ms cubic-bezier(0.3, 0, 0.2, 1) both" }}
      >
        {text}
      </p>
    </div>
  );
}
