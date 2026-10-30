export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-[1.35rem] font-bold tracking-[-0.03em] ${className}`}>
      <span className="font-serif italic text-ink">∂</span>
      <span>raft</span>
    </span>
  );
}
