import { CheckIcon } from "./icons";
import { Reveal } from "./motion";

const ladder = [
  { level: "1", name: "Nudge", body: "A guiding question. “What’s the rule for ∫ u dv?”", when: "First" },
  { level: "2", name: "Hint", body: "The idea or rule, never the result.", when: "Still stuck" },
  { level: "3", name: "One step", body: "Writes only the next line on your page, in its own colour.", when: "You ask for it" },
];

const compare = [
  { them: "Shows the full solution", us: "Teaches the one step you’re stuck on" },
  { them: "Screenshot, upload, type", us: "Circle it and ask" },
  { them: "You copy it and forget it", us: "You solve it, and it’s checked" },
];

export function WhyHints() {
  return (
    <section id="why" className="scroll-mt-16">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20 lg:py-32">
        <Reveal>
          <p className="t-eyebrow text-ink">Hints, not answers</p>
          <h2 className="t-h2 mt-3">
            Other apps give you the answer.
            <br />
            <span className="text-muted">∂raft gives you the why.</span>
          </h2>
          <p className="t-lede mt-6 text-muted">
            Copying a solution at midnight feels like progress, until the exam. ∂raft starts with the smallest
            nudge and only goes further when you need it.
          </p>

          <div className="mt-10 overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-2 bg-paper-2 text-[0.8rem] font-semibold">
              <span className="px-4 py-3 text-subtle">Answer apps</span>
              <span className="px-4 py-3 text-ink">∂raft</span>
            </div>
            {compare.map((row) => (
              <div key={row.us} className="grid grid-cols-2 border-t border-line text-[0.92rem] leading-[1.45]">
                <span className="px-4 py-3.5 text-subtle">{row.them}</span>
                <span className="flex items-start gap-2 px-4 py-3.5 font-medium text-text">
                  <CheckIcon className="mt-[3px] h-4 w-4 shrink-0 text-check" />
                  {row.us}
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="graph-paper surface-lg relative rounded-[22px] p-6 sm:p-9">
            <p className="t-small font-semibold text-subtle">The hint ladder</p>
            <ol className="mt-5 space-y-3">
              {ladder.map((r, i) => (
                <li key={r.name} className="surface flex items-start gap-4 rounded-2xl p-5" style={{ marginLeft: `${i * 1.25}rem` }}>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.9rem] font-bold tabular-nums ${
                      i === 0 ? "bg-ink text-white" : "bg-ink-wash text-ink"
                    }`}
                  >
                    {r.level}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em]">{r.name}</h3>
                      <span className="t-small text-subtle">{r.when}</span>
                    </div>
                    <p className="mt-1 text-[0.93rem] leading-[1.5] text-muted">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="hand mt-7 text-center text-[1.5rem] font-semibold !text-ink">
              then it hands the pen back to you
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
