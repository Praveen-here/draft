"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#why", label: "Hints, not answers" },
  { href: "#agent", label: "The agent" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="glass sticky top-0 z-50">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="pressable rounded-lg" aria-label="∂raft home">
          <Logo />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="pressable t-small rounded-full px-3.5 py-2 font-medium text-muted transition-colors hover:text-text"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#demo" className="pressable btn-primary t-small rounded-full px-4 py-2 font-semibold">
          See the demo
        </a>
      </nav>

      {/* Scroll edge: a soft fade instead of a hard divider, only once content is underneath */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-[rgba(16,24,40,0.05)] to-transparent transition-opacity duration-300"
        style={{ opacity: scrolled ? 1 : 0 }}
      />
    </header>
  );
}
