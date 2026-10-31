/**
 * Who the learner is, in the browser: one id per device, kept in localStorage (no sign-in yet).
 * The server keeps what it learns about them in Postgres under this id (src/lib/server/learnerStore.ts).
 */
const KEY = "draft.learner";

export function learnerId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      // randomUUID needs a secure page (https or localhost); a tablet on the LAN over http gets the fallback.
      id = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined; // storage blocked: teach without memory
  }
}

/** Tell the server what the math engine said about a handwritten line (fire and forget). */
export function reportLine(problemId: string, problem: string, verdict: "ok" | "wrong" | "solved") {
  const id = learnerId();
  if (!id) return;
  void fetch("/api/learner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ learnerId: id, problemId, problem, verdict }),
  }).catch(() => {});
}
