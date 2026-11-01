"use client";

/**
 * Signing in with Google, in the browser (server: src/lib/server/auth.ts, /api/auth/*).
 * useAccount() tells who is signed in; signInWithGoogle() goes to Google and comes back to `then`.
 */
import { useEffect } from "react";
import { createAuthClient } from "better-auth/react";
import { learnerId } from "@/lib/agent";

const client = createAuthClient();

/**
 * Google sign-in is on only with NEXT_PUBLIC_GOOGLE_LOGIN=on in .env.local (paused for now: the buttons just open
 * the app, and each device keeps its own documents and memory, as before sign-in existed).
 */
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "on";

export type Account = { id: string; name: string; email: string; image?: string | null };

/** The signed-in account (null when signed out), and whether that's still being checked. */
export function useAccount(): { account: Account | null; checking: boolean } {
  const { data, isPending } = client.useSession();
  const user = data?.user;
  useClaimDevice(user?.id);
  return { account: user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null, checking: isPending };
}

/** Off to Google's account picker; back at `then` (a path in this app) once signed in. */
export function signInWithGoogle(then = "/app") {
  return client.signIn.social({ provider: "google", callbackURL: then });
}

export async function signOut() {
  await client.signOut();
}

/**
 * The first time an account signs in on this device, what the device saved before signing in (documents,
 * the tutor's memory) moves into the account. Once per account per device.
 */
function useClaimDevice(userId: string | undefined) {
  useEffect(() => {
    const device = learnerId();
    if (!userId || !device) return;
    const key = `draft.claimed.${userId}`;
    try { if (localStorage.getItem(key)) return; } catch { return; }
    void fetch("/api/account/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        localStorage.setItem(key, "1");
        const { moved } = (await res.json()) as { moved?: { documents: number } };
        // Lists already on screen (Recent) reload to show the documents that just moved in.
        if (moved?.documents) window.dispatchEvent(new Event("draft:documents-changed"));
      })
      .catch(() => {});
  }, [userId]);
}
