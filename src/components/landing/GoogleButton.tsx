"use client";

import Link from "next/link";
import { useState } from "react";
import { signInWithGoogle, useAccount } from "@/lib/account";

const STYLE =
  "pressable inline-flex items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-6 py-3.5 text-[0.98rem] font-semibold text-[#1f1f1f] shadow-[0_1px_2px_rgba(16,24,40,0.06),0_6px_16px_-8px_rgba(16,24,40,0.18)] transition-[background-color,box-shadow] duration-150 hover:bg-[#f8f9fb] disabled:opacity-70";

/**
 * Sign in with Google (Better Auth), styled after Google's light "Continue with Google" button.
 * Already signed in: it says "Continue as <name>" and opens the app.
 */
export function GoogleButton({ className = "", then = "/app" }: { className?: string; then?: string }) {
  const { account } = useAccount();
  const [going, setGoing] = useState(false);
  if (account) {
    return (
      <Link href={then} className={`${STYLE} ${className}`}>
        <GoogleG className="h-5 w-5" />
        Continue as {account.name.split(" ")[0] || account.email}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={going}
      onClick={() => {
        setGoing(true);
        void signInWithGoogle(then).catch(() => setGoing(false));
      }}
      className={`${STYLE} ${className}`}
    >
      <GoogleG className="h-5 w-5" />
      {going ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
