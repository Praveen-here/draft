import type { Metadata, Viewport } from "next";
import { Caveat } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "∂raft: circle it, ask it, get it",
  description:
    "Circle the math step you're stuck on, ask out loud, and ∂raft teaches you that exact step. Then you solve it yourself.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={caveat.variable}>
      <body>{children}</body>
    </html>
  );
}
