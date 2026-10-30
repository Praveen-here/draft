import { ArrowIcon } from "./icons";
import { Logo } from "./Logo";
import { Reveal } from "./motion";

const team = ["Praveen Kumar D", "T Raveendra", "Sanjay M S", "Darshana G"];

export function Closing() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="page-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 lg:py-36">
          <Reveal>
            <p className="hand text-[1.7rem] font-semibold !text-ink">11:40 pm. Exam tomorrow.</p>
            <h2 className="t-display mt-4 !text-[clamp(2.6rem,5.6vw,4.6rem)]">
              Unstuck in two minutes,
              <br />
              <span className="text-muted">not twenty.</span>
            </h2>
            <div className="mt-10 flex justify-center">
              <a
                href="#demo"
                className="pressable btn-primary inline-flex items-center gap-2 rounded-full px-7 py-4 text-[1rem] font-semibold"
              >
                Watch it teach
                <ArrowIcon className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer id="team" className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Logo />
            <p className="t-small mt-2 text-subtle">
              Built by Team KingWraps · PES University · Encode.ai Agentathon 2026
            </p>
          </div>
          <ul className="t-small flex flex-wrap gap-x-5 gap-y-2 text-muted">
            {team.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
