"use client";

/**
 * Graph of `fn` over `xRange`, with parameters that can change live while ∂raft talks.
 * TODO(D): real plotting (Mafs or function-plot, Q13) and smooth parameter animation.
 */
export function Graph({
  fn,
  xRange,
  params,
}: {
  fn: string;
  xRange: [number, number];
  params: Record<string, number>;
}) {
  return (
    <div className="surface flex h-48 w-72 flex-col items-center justify-center gap-1 text-sm text-muted">
      <span className="font-semibold text-text">y = {fn}</span>
      <span>
        x from {xRange[0]} to {xRange[1]}
        {Object.entries(params).map(([k, v]) => ` · ${k} = ${v}`)}
      </span>
    </div>
  );
}
