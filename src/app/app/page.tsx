"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { StartScreen } from "@/components/app/StartScreen";
import type { DocSource } from "@/components/app/types";
import { MotionProvider } from "@/components/landing/motion";

// The canvas touches window/pointer APIs, so it only renders in the browser.
const Canvas = dynamic(() => import("@/components/app/Canvas").then((m) => m.Canvas), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-white" />,
});

export default function AppPage() {
  const [source, setSource] = useState<DocSource | null>(null);

  return (
    <MotionProvider>
      {source ? <Canvas source={source} onExit={() => setSource(null)} /> : <StartScreen onOpen={setSource} />}
    </MotionProvider>
  );
}
