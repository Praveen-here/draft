// Server-only: sign in with Google (Better Auth). Users, sessions and linked Google accounts are kept in our
// own Postgres (tables auth_*, created on first use). Settings come from .env.local: GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL (see docs/SERVICES_AND_KEYS.md). Never import
// this from client code.

import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";
import { validLearnerId } from "./learnerStore";

/** Where the app may be opened from: this laptop, and a tunnel to it (Cloudflare or ngrok) (e.g. a tablet on HTTPS). */
const HOSTS = ["localhost:3000", "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.dev"];

export const auth = betterAuth({
  database: pool() ?? undefined,
  // The sign-in return address follows the address the app was opened on (Google must also list it).
  baseURL: { allowedHosts: HOSTS, fallback: process.env.BETTER_AUTH_URL || "http://localhost:3000" },
  // The tunnel forwards to plain http on this laptop and says the original was https in x-forwarded-proto.
  advanced: { trustedProxyHeaders: true },
  trustedOrigins: ["http://localhost:3000", ...HOSTS.filter((h) => h.startsWith("*.")).map((h) => `https://${h}`)],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Let the student pick which Google account, every time (shared family laptops).
      prompt: "select_account",
    },
  },
  // Our tables are learners, problems, documents: keep the sign-in ones clearly apart.
  user: { modelName: "auth_users" },
  session: { modelName: "auth_sessions" },
  account: { modelName: "auth_accounts" },
  verification: { modelName: "auth_verifications" },
  telemetry: { enabled: false },
  plugins: [nextCookies()],
});

const shared = ((globalThis as { __draftAuth?: { ready: Promise<void> | null } }).__draftAuth ??= { ready: null });

/** Create the sign-in tables on first use (and add any new columns after a Better Auth update). */
export function authReady(): Promise<void> {
  shared.ready ??= getMigrations(auth.options)
    .then((m) => m.runMigrations())
    .catch((err) => {
      shared.ready = null;
      throw err;
    });
  return shared.ready;
}

/**
 * Who is asking. Signed in: their account (the id the browser sends is ignored, so nobody can read someone
 * else's documents by guessing an id). Signed out: refused in production; while developing, the browser's own
 * device id is accepted, so the app and its tests work without a Google login.
 */
export async function learnerFor(request: Request, deviceId?: string | null): Promise<string | null> {
  try {
    await authReady();
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.id) return session.user.id;
  } catch {
    /* no database or sign-in not set up: fall through */
  }
  // Sign-in paused (NEXT_PUBLIC_GOOGLE_LOGIN not "on"): every device is its own learner, as before sign-in.
  if ((process.env.NEXT_PUBLIC_GOOGLE_LOGIN !== "on" || process.env.NODE_ENV !== "production") && validLearnerId(deviceId)) return deviceId;
  return null;
}
