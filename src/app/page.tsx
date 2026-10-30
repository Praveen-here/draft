import { Agent } from "@/components/landing/Agent";
import { Closing } from "@/components/landing/Closing";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MotionProvider } from "@/components/landing/motion";
import { Nav } from "@/components/landing/Nav";
import { WhyHints } from "@/components/landing/WhyHints";

export default function Home() {
  return (
    <MotionProvider>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <WhyHints />
        <Agent />
      </main>
      <Closing />
    </MotionProvider>
  );
}
