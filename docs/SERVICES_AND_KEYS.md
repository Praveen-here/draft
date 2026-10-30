# Services, Keys, Limits and Costs

Last updated: 31 Oct 2026. **No key values in this file, ever.**

---

## 1. Key naming standard

Pattern: **`SERVICE_KEY_ENV`**, where ENV is `DEV` or `DEMO`.

| Service | Dev key | Demo key | Status |
|---|---|---|---|
| Google Gemini | `GEMINI_KEY_DEV` | `GEMINI_KEY_DEMO` | ✅ both created + tested |
| Gradium | `GRADIUM_KEY_DEV` | `GRADIUM_KEY_DEMO` | ✅ dev tested · ⬜ demo account not created yet |
| Groq | `GROQ_KEY_DEV` | `GROQ_KEY_DEMO` | ✅ both created · dev tested |
| TypeSafe Jev | `JEV_KEY_DEV` | `JEV_KEY_DEMO` | ⏸ not purchased (see DECISIONS) |

Plus one switch: `APP_ENV=dev` (laptops) / `APP_ENV=demo` (Vercel production, demo laptop).

> ⚠️ **To fix:** the lead's `.env.local` currently has the Groq dev key named `GROQ_DEV_KEY`. Rename it to `GROQ_KEY_DEV` to match the pattern.

**Where keys live:**
- `.env.local` on each laptop (git-ignored), **dev keys only** ideally
- Shared password manager (Bitwarden), all keys, clearly labelled with owner + account
- Vercel → Settings → Environment Variables (Production), demo keys

**Rules:** keys stay **server-side** (Next.js API routes). The browser only ever gets short-lived tokens (Gradium token, Gemini Live ephemeral token).

---

## 2. Google Gemini (AI Studio)

- **Console:** https://aistudio.google.com
- **What we use:** Gemini Flash (planner, ink reading, explanations), Flash-Lite (fallback), Live API (backup voice), Flash TTS (backup TTS). One key covers all of them.
- **Projects:** `draft-dev`, `draft-demo` (the lead's account). Teammates: one `draft-dev-<name>` each.
- **Limits:** per **project**, not per key. Google no longer publishes numbers; see AI Studio → **Rate Limit**. Third-party reports range from ~5–30 RPM and ~100–1000 RPD for Flash on the free tier. **Write our real numbers here:**
  - Flash: RPM __ · RPD __ · TPM __
  - Flash-Lite: RPM __ · RPD __ · TPM __
  - Live: __
- **Paid prices (if billing is enabled on demo):** 3.6/3.8 Flash $0.75 in / $3.75 out per 1M tokens (until 31 Dec 2026); 3.5 Flash-Lite $0.30 / $2.50. A hackathon's usage would likely cost < $1–2.
- **Notes:**
  - Free-tier prompts on 3.6/3.8 Flash may be used by Google to improve products. Don't upload private material.
  - Enabling billing → Tier 1 (much higher limits). **Set a budget alert first** (e.g. ₹500).
  - Google AI **Plus** gives no API credits. AI **Pro** includes ~$10/month of Cloud credits usable on the Gemini API (via Google Developer Program benefits).
  - The $300 Cloud trial may **not** cover Gemini API for new accounts (sources conflict). Check before relying on it.

---

## 3. Gradium (speech-to-text + text-to-speech)

- **Studio:** https://gradium.ai · **Docs:** https://docs.gradium.ai
- **Auth header:** `x-api-key: gd_...`
- **Base URLs:** REST `https://api.gradium.ai/api` · WebSocket `wss://api.gradium.ai/api`
- **Endpoints we use:**
  | Purpose | Method + path |
  |---|---|
  | TTS (REST) | `POST /post/speech/tts` |
  | STT (REST) | `POST /post/speech/asr?json_config=...` |
  | TTS / STT streaming | `wss://api.gradium.ai/api/speech/tts` / `.../speech/asr` (check docs for the exact STT path) |
  | Browser token (single-use) | `GET /api-keys/token` → `{ token, expires_at }`, passed as `?token=` |
  | Credits left | `GET /usages/credits` |
- **Free plan:** 45,000 credits/month per account, **API access works** (tested). About 2 TTS + 3 STT concurrent sessions. Not licensed for commercial use.
- **Credit cost:** TTS **1 credit/character** (~1 h of speech/month) · STT **3 credits/second** (~4 h of listening/month).
- **Paid if needed:** XS $12/month (225k credits, first month free).
- **Plan:** each teammate has their own dev account. One separate **demo account**, never used for testing.
- **Important settings:**
  - `delay_in_frames`: default came back as **50 (= 4 s lag)**. Use **8–16**.
  - `keywords`: boost math words (`integral`, `derivative`, `dx`, …), boost 3, max 500.
  - Max session length: 3000 s, so reconnect after.
- **Test voice ID:** `YTpq7expH9539ERJ` (quickstart voice). Final tutor voice: **[OPEN]**.

---

## 4. Groq ("is this for me?" gate)

- **Console:** https://console.groq.com
- **Endpoint:** `POST https://api.groq.com/openai/v1/chat/completions` (OpenAI-compatible), header `Authorization: Bearer gsk_...`
- **Model chosen:** `qwen/qwen3.8-27b` with `temperature: 0`, `reasoning_effort: "none"`, `response_format: {type: "json_object"}`
- **Models available on our account (31 Oct 2026):** `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `whisper-large-v3`, `whisper-large-v3-turbo`, `allam-2-7b`, `meta-llama/llama-prompt-guard-2-*`, `canopylabs/orpheus-*` (TTS). ❌ `llama-3.1-8b-instant` is gone.
- **Limits:** per **organisation**, not per key. Check console → Limits for `qwen/qwen3.8-27b` and write them here: RPM __ · RPD __ · TPM __
- **Bonus:** `whisper-large-v3-turbo` = free backup speech-to-text.
- **Security note:** the old key `gsk_512c…` was exposed in chat and has been **deleted**.

---

## 5. TypeSafe Jev (on hold)

- **Console:** https://console.typesafe.ai
- **Price:** ~$0.042 per 1M input tokens, output free (third-party sources; no official pricing page found).
- **Minimum top-up:** **$5**. That's about 119M tokens, or ~250k–400k gate checks. Our whole build + demo would use ~$0.35.
- **Why on hold:** Groq does the same job free, at the same speed, in our tests. Jev's advantage is **calibrated** probabilities.
- **If we buy:** enable international transactions on the card; invite teammates under Settings → Members; create `draft-dev` / `draft-demo` keys; check Usage after 20 test calls.

---

## 6. Other free tools (no keys needed)

| Tool | Use | Note |
|---|---|---|
| Next.js + React | App + API routes | — |
| Vercel AI SDK (`ai`, `@ai-sdk/google`) | Streaming + tool calling | — |
| tldraw | Canvas | Free with "made with tldraw" watermark |
| pdf.js | Render PDF + text with positions | — |
| `@ricky0123/vad-web` | In-browser voice activity detection | Must test in iPad Safari |
| nerdamer + math.js | Step checking | — |
| `@cortex-js/compute-engine` | LaTeX → expression | Optional |
| KaTeX | Math display | — |
| function-plot | Graphs | — |
| Kalam / Caveat (Google Fonts) | Tutor "handwriting" | — |
| Vercel Hobby | Hosting | No WebSockets in functions → use browser tokens |
| Cloudflare Tunnel (`cloudflared`) | HTTPS for the local demo laptop | — |
| Bitwarden | Shared key storage | — |

---

## 7. Budget

| Item | Expected |
|---|---|
| Gemini | $0 (free); maybe < $2 if billing on demo |
| Gradium | $0 (free plan works) |
| Groq | $0 |
| Jev | $0 (on hold) or $5 |
| **Total** | **$0–7** |
