type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function LayersIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />
  </svg>;
}

export function FolderIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4H9l2 3h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V7Z" />
  </svg>;
}

export function SelectIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M5.5 4.5l12 6.2-5.3 1.4-2.3 5.1L5.5 4.5z" />
    </svg>
  );
}

export function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M4 20l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.4 18.8 4 20z" />
      <path d="M13.5 7.3l3.2 3.2" />
    </svg>
  );
}

export function HighlighterIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M9 14.5l-3 3V20h3.5l3-3" />
      <path d="M9 14.5l7.6-9a1.8 1.8 0 0 1 2.6-.1l.4.4a1.8 1.8 0 0 1-.1 2.6l-9 7.6L9 14.5z" />
      <path d="M4 21h7" />
    </svg>
  );
}

export function EraserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M8.5 19.5l-4-4a1.6 1.6 0 0 1 0-2.3l8.7-8.7a1.6 1.6 0 0 1 2.3 0l4 4a1.6 1.6 0 0 1 0 2.3l-7.8 7.8" />
      <path d="M8.5 19.5h11M7 10.6l6.4 6.4" />
    </svg>
  );
}

export function UndoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M9 7.5L5 11.5l4 4" />
      <path d="M5.5 11.5h8.5a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

export function RedoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M15 7.5l4 4-4 4" />
      <path d="M18.5 11.5H10a5 5 0 0 0 0 10h2" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base} strokeWidth={2}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  );
}

export function FitIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M4.5 9V5.5a1 1 0 0 1 1-1H9M15 4.5h3.5a1 1 0 0 1 1 1V9M19.5 15v3.5a1 1 0 0 1-1 1H15M9 19.5H5.5a1 1 0 0 1-1-1V15" />
    </svg>
  );
}

export function PlusPageIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M12 9v6M9 12h6" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
      <path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" />
      <path d="M4.5 14.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function DocIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3Z" />
    <path d="M14 3v5h5M9 13h6M9 16.5h4" />
  </svg>;
}

export function TrashIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </svg>;
}
