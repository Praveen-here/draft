// Sign in with Google (Better Auth): /api/auth/sign-in/social, /api/auth/callback/google, /api/auth/get-session,
// /api/auth/sign-out and the rest. The tables are created on the first request.

import { toNextJsHandler } from "better-auth/next-js";
import { auth, authReady } from "@/lib/server/auth";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await authReady();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await authReady();
  return handler.POST(request);
}
