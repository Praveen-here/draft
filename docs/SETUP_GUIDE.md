# Setup Guide (for every teammate)

Follow this once on your own laptop. It takes about 30–40 minutes.
Commands are for **Windows PowerShell**. Never paste keys into chat, WhatsApp or git.

---

## 0. Before you start

- Install: **Node 20+ LTS**, **Git**, **VS Code**
- Get access to the team **Bitwarden** (ask the lead)
- Create `.env.local` in the project folder (copy `.env.example`), and fill it in as you go:
  ```
  APP_ENV=dev
  GEMINI_KEY_DEV=
  GRADIUM_KEY_DEV=
  GROQ_KEY_DEV=
  ```
- **Tip:** don't select/highlight key lines in VS Code while using an AI assistant. The selection can be sent along with your message.

To load a key from `.env.local` into PowerShell without pasting it:
```powershell
function Get-Key($name) { ((Select-String -Path .env.local -Pattern "^$name=" | Select-Object -Last 1).Line -replace "^$name=",'').Trim() }
$k = Get-Key "GROQ_KEY_DEV"; "loaded: $($k.Substring(0,4))... length $($k.Length)"
```
If `Select-String` finds the name twice, you have a duplicate line. Keep only one.

---

## 1. Google Gemini

1. Go to https://aistudio.google.com and sign in with **your own** Google account.
2. Sidebar → **Projects** → **Create a new project** → name `draft-dev-<yourname>`.
   (Or **API Keys → Create API key → create in new project**.)
3. **API Keys → Create API key** → choose your project → copy the `AIza...` key.
4. Save it in Bitwarden as `GEMINI_KEY_DEV_<NAME>` and in `.env.local` as `GEMINI_KEY_DEV`.
5. Sidebar → **Rate Limit**: note the limits for Flash / Flash-Lite / Live.
6. Test:
   ```powershell
   $k = Get-Key "GEMINI_KEY_DEV"
   curl.exe -H "x-goog-api-key: $k" "https://generativelanguage.googleapis.com/v1beta/models"
   ```
   A list of models means it works. Note the exact Flash / Flash-Lite model names.

Limits are **per project**, so extra keys in the same project don't help.

---

## 2. Gradium

1. Go to https://gradium.ai → sign up with **your own** email → you land in **Studio** (Free, 45k credits).
2. Find **API Keys** (sidebar, or profile menu → Organization) → **Create** → name `draft-dev-<yourname>` → copy the `gd_...` key.
3. Save to Bitwarden and `.env.local` as `GRADIUM_KEY_DEV`.
4. Check credits:
   ```powershell
   $k = Get-Key "GRADIUM_KEY_DEV"
   curl.exe -H "x-api-key: $k" "https://api.gradium.ai/api/usages/credits"
   ```
5. Test text-to-speech:
   ```powershell
   cd $env:TEMP
   '{"text":"Good question! The minus comes from the integration by parts rule.","voice_id":"YTpq7expH9539ERJ","output_format":"wav","only_audio":true}' | Set-Content -Encoding ascii tts.json
   curl.exe -X POST "https://api.gradium.ai/api/post/speech/tts" -H "x-api-key: $k" -H "Content-Type: application/json" --data-binary "@tts.json" -o hello.wav
   start hello.wav
   ```
6. Test speech-to-text (low delay + math keywords), showing only the text lines:
   ```powershell
   $cfg = [uri]::EscapeDataString('{"language":"en","delay_in_frames":12,"keywords":{"words":["integral","derivative","integration","minus","dx"],"boost":3}}')
   curl.exe -s -X POST "https://api.gradium.ai/api/post/speech/asr?json_config=$cfg" -H "x-api-key: $k" -H "Content-Type: audio/wav" --data-binary "@hello.wav" | Select-String '"type":"(text|ready)"'
   ```
   `ready` should show `"delay_in_frames":12`. Also try a recording of **your own voice**.
7. Clean up: `Remove-Item tts.json, hello.wav; Clear-History`

> Step 5 moves you into the Temp folder. `cd` back to the project folder before using `Get-Key` again.

---

## 3. Groq

1. Go to https://console.groq.com → sign in with **your own** account.
2. **API Keys → Create API Key** → name `draft-dev-<yourname>` → copy the `gsk_...` key (shown only once).
3. Save to Bitwarden and `.env.local` as `GROQ_KEY_DEV`.
4. **Settings → Limits**: note limits for `qwen/qwen3.8-27b`.
5. Check the key + models:
   ```powershell
   $k = Get-Key "GROQ_KEY_DEV"
   (Invoke-RestMethod "https://api.groq.com/openai/v1/models" -Headers @{Authorization="Bearer $k"}).data.id
   ```
6. Run the gate test from [prompts/gate-prompt.md](prompts/gate-prompt.md#powershell-test).

---

## 4. Demo accounts (lead only)

- Gemini: project `draft-demo` ✅
- Groq: `draft-demo` key ✅ (ideally move it to a separate account for its own quota)
- Gradium: create a **separate account** (team email) → key `GRADIUM_KEY_DEMO` ⬜
- Store all demo keys only in Bitwarden + Vercel. **Don't use them while building.**

---

## 5. Common errors

| Error | Meaning | Fix |
|---|---|---|
| `Invalid API Key` | `$k` empty, wrong service's key, or a deleted key | Reload with `Get-Key`; check the prefix (`AIza` / `gd_` / `gsk_`) |
| `Method ... 'Trim'` on `Object[]` | Same variable name appears twice in `.env.local` | Keep one line |
| `model_not_found` | Model retired | List models and choose another |
| `429` | Rate limit hit | Wait a minute; use your own account |
| `curl` behaves oddly in PowerShell | `curl` is an alias there | Use `curl.exe` |
