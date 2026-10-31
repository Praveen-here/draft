// Server-only: picks dev or demo keys with one APP_ENV switch (docs/APPROACH_DRAFT.md §10).
// Never import this from client code: keys must not reach the browser.

const env = process.env.APP_ENV === "demo" ? "DEMO" : "DEV";

export function key(service: "GEMINI" | "GRADIUM" | "GROQ"): string {
  const name = `${service}_KEY_${env}`;
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}
