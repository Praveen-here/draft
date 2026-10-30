import { Reveal } from "./motion";

const loop = [
  { verb: "See", what: "what you circled" },
  { verb: "Hear", what: "your question" },
  { verb: "Read", what: "your handwriting" },
  { verb: "Check", what: "the math, for real" },
  { verb: "Explain", what: "out loud, one hint" },
  { verb: "Wait", what: "for your next line" },
];

const unsure = [
  { quote: "Did you mean this?", when: "When your writing is hard to read, it shows what it read first." },
  { quote: "This step, or the whole problem?", when: "When the circle is unclear, it asks instead of assuming." },
  { quote: "I’m not sure.", when: "When the AI and the math engine disagree, it trusts the engine or says so." },
];

export function Agent() {
  return (
    <section id="agent" className="scroll-mt-16 border-t border-line/70 bg-paper-2">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <Reveal className="max-w-2xl">
          <p className="t-eyebrow text-ink">The agent</p>
          <h2 className="t-h2 mt-3">A tutor that thinks in steps.</h2>
          <p className="t-lede mt-5 text-muted">
            &ldquo;Why is this minus here?&rdquo; means nothing on its own. ∂raft puts together what you circled,
            what you said and the lines above it, then works through one doubt in many small steps.
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <ol className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {loop.map((s, i) => (
              <li key={s.verb} className="surface relative rounded-2xl p-5">
                <span className="t-small font-semibold tabular-nums text-subtle">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-6 text-[1.2rem] font-semibold tracking-[-0.018em]">{s.verb}</p>
                <p className="mt-1 text-[0.88rem] leading-[1.4] text-muted">{s.what}</p>
              </li>
            ))}
          </ol>
          <p className="t-small mt-4 text-subtle">
            It repeats until the math engine says your line is right, or you say &ldquo;got it.&rdquo;
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-20">
          <h3 className="t-h3">Honest when it isn&rsquo;t sure.</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {unsure.map((u) => (
              <figure key={u.quote} className="rounded-2xl border border-line bg-white p-6">
                <blockquote className="hand text-[1.6rem] font-semibold leading-[1.15] !text-ink">{u.quote}</blockquote>
                <figcaption className="mt-3 text-[0.92rem] leading-[1.5] text-muted">{u.when}</figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
