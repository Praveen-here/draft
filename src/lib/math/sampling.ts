import type { Expr } from "./lineParse";

/** exact: same value everywhere. constant: differ by a fixed constant (indefinite integrals, + C). */
export type Mode = "exact" | "constant";

export type Verdict =
  | { same: true }
  | { same: false; unsure: true }
  | { same: false; unsure: false; at: Record<string, number>; a: number; b: number };

type Opts = { mode: Mode; main: string; positive?: boolean; tol?: number };

/** Seeded random numbers, so a check gives the same verdict every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Points to try: x in [-3, 3] and (0, 3]; only (0.3, 2.5) when integrals are involved. Other letters are fixed per round. */
function* rounds(vars: string[], main: string, positive: boolean) {
  const rand = rng(1234567);
  for (let round = 0; round < 2; round++) {
    const params: Record<string, number> = {};
    for (const v of vars) if (v !== main) params[v] = 0.6 + rand() * 1.8;
    const xs = positive
      ? Array.from({ length: 12 }, () => 0.3 + rand() * 2.2)
      : [...Array.from({ length: 8 }, () => -3 + rand() * 6), ...Array.from({ length: 8 }, () => 0.15 + rand() * 2.85)];
    yield xs.map((x) => ({ ...params, [main]: x }));
  }
}

/** Are a and b the same expression (exactly, or up to a constant)? */
export function compare(a: Expr, b: Expr, { mode, main, positive = false, tol = 1e-6 }: Opts): Verdict {
  const vars = [...new Set([...a.variables, ...b.variables])];
  for (const points of rounds(vars, main, positive)) {
    const valid: { at: Record<string, number>; a: number; b: number }[] = [];
    for (const at of points) {
      const va = a.evaluate(at), vb = b.evaluate(at);
      if (Number.isFinite(va) && Number.isFinite(vb)) valid.push({ at, a: va, b: vb });
      if (valid.length === 6) break;
    }
    if (valid.length < 4) return { same: false, unsure: true };
    const d0 = valid[0].a - valid[0].b;
    for (const p of valid) {
      // up to a constant: the gap a − b is the same at every point (scaled by the values' size)
      const ok = mode === "exact" ? close(p.a, p.b, tol) : Math.abs(p.a - p.b - d0) <= tol * Math.max(1, Math.abs(p.a), Math.abs(p.b));
      if (!ok) return { same: false, unsure: false, ...p };
    }
  }
  return { same: true };
}

/** Is f1 a constant (non-zero) multiple of f2? Used for equations written as lhs − rhs. */
export function proportional(f1: Expr, f2: Expr, main: string, tol = 1e-6): boolean | "unsure" {
  const vars = [...new Set([...f1.variables, ...f2.variables])];
  for (const points of rounds(vars, main, false)) {
    let k: number | undefined;
    let used = 0;
    for (const at of points) {
      const a = f1.evaluate(at), b = f2.evaluate(at);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      used++;
      if (k === undefined) {
        if (Math.abs(b) < 1e-9) { if (Math.abs(a) > 1e-9) return false; continue; }
        k = a / b;
        if (Math.abs(k) < 1e-12) return false;
        continue;
      }
      if (!close(a, k * b, tol)) return false;
    }
    if (used < 4 || k === undefined) return "unsure";
  }
  return true;
}

/** Real roots of f(main) = 0 in [-10, 10], other letters fixed. Rejects poles (sign changes where |f| blows up). */
export function roots(f: Expr, main: string, fixed: Record<string, number> = {}): number[] {
  const at = (x: number) => f.evaluate({ ...fixed, [main]: x });
  const found: number[] = [];
  const add = (r: number) => {
    if (!found.some((q) => Math.abs(q - r) < 1e-6)) found.push(Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r);
  };
  const step = 0.01;
  let x0 = -10, y0 = at(x0);
  for (let i = 1; i <= 2000; i++) {
    const x1 = -10 + i * step, y1 = at(x1);
    if (Number.isFinite(y0) && Math.abs(y0) < 1e-12) add(x0);
    if (Number.isFinite(y0) && Number.isFinite(y1) && y0 * y1 < 0) {
      let lo = x0, hi = x1, flo = y0;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2, fm = at(mid);
        if (!Number.isFinite(fm)) break;
        if (flo * fm <= 0) hi = mid;
        else { lo = mid; flo = fm; }
      }
      const r = (lo + hi) / 2;
      if (Math.abs(at(r)) < 1e-6) add(r);
    } else if (Number.isFinite(y0) && Number.isFinite(y1) && i > 1) {
      // touching roots like (x − 2)² = 0: |f| has a tiny local minimum
      const ym = at(x0 - step);
      if (Math.abs(y0) < 1e-4 && Math.abs(y0) <= Math.abs(ym) && Math.abs(y0) <= Math.abs(y1)) {
        let lo = x0 - step, hi = x1;
        for (let k = 0; k < 80; k++) {
          const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
          if (Math.abs(at(m1)) < Math.abs(at(m2))) hi = m2;
          else lo = m1;
        }
        const r = (lo + hi) / 2;
        if (Math.abs(at(r)) < 1e-9) add(r);
      }
    }
    x0 = x1;
    y0 = y1;
  }
  return found.sort((p, q) => p - q);
}

/** Short, readable number for messages: 2, 5.5, 0.333. */
export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(3)));
}
