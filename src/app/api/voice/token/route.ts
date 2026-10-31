// Part C: GET /api/voice/token. Mints a single-use Gradium token so the browser never sees the key.
// Gradium: GET https://api.gradium.ai/api/api-keys/token with header x-api-key (docs/SERVICES_AND_KEYS.md).

export async function GET() {
  // TODO(C): read GRADIUM_KEY_DEV / GRADIUM_KEY_DEMO via APP_ENV, fetch a token, return { token }.
  return Response.json({ error: "not built yet" }, { status: 501 });
}
