# "Is this for me?" gate prompt

**Status:** tested 31 Oct 2026, 14/14 correct, median 266 ms on Groq `qwen/qwen3.8-27b`.

> **Now a backup (D15):** the app has a mic on/off button, so the student says when they're talking to the tutor. This prompt was written for an always-on mic. If we keep it (Q10), it only runs while the mic is on, to skip thinking aloud.

## Settings

```json
{
  "model": "qwen/qwen3.8-27b",
  "temperature": 0,
  "reasoning_effort": "none",
  "response_format": { "type": "json_object" }
}
```

## System prompt

```
You are the "is this for me?" filter for Draft, an AI math tutor app. The microphone is always on.
Decide if the student is ADDRESSING THE TUTOR (asking for help, asking a question, asking to check work).

NOT for the tutor:
- Thinking aloud / narrating their own working ("okay so u equals x", "carry the two", "then dv is e to the x")
- Reading the problem text aloud ("find the integral of x e to the x dx", "question 4")
- Talking to other people, fillers, complaints, exclamations ("hmm", "ugh", "mom I'm coming")

FOR the tutor:
- Questions or requests for help/explanation/checking ("why is there a minus", "is this right", "explain this step", "I don't get this")
- Anything starting with "draft" or "hey draft"
A recent circle (circled_seconds_ago under 10) makes a question MORE likely for the tutor, but narration is still not for the tutor.

Reply ONLY with JSON: {"for_me": true or false, "confidence": number 0 to 1}
```

## User message format

```
said: "<transcript>"
circled_seconds_ago: <number, 99 if none>
pen_moving: <true|false>
tutor_just_spoke: <true|false>
```

## How to use the answer

- Use **`for_me` only**. `confidence` is always ~0.95 and isn't meaningful.
- Run cheap **rules first** (starts with "draft" → yes; "hmm"/"okay" → no; matches PDF text → no). Call Groq only for the rest.
- On Groq error/429 → same prompt on Gemini Flash-Lite.

## PowerShell test

Run from the project folder (needs `GROQ_KEY_DEV` in `.env.local`):

```powershell
$k = ((Select-String -Path .env.local -Pattern '^GROQ_KEY_DEV=' | Select-Object -Last 1).Line -replace '^GROQ_KEY_DEV=','').Trim()
$system = Get-Content docs\prompts\gate-system.txt -Raw
$tests = @(
  @{said="why is there a minus here"; circled=2;  expect=$true},
  @{said="can you explain this step"; circled=5;  expect=$true},
  @{said="I don't get where the e to the x came from"; circled=99; expect=$true},
  @{said="draft what is integration by parts"; circled=99; expect=$true},
  @{said="is this right"; circled=3; expect=$true},
  @{said="okay so u equals x"; circled=99; expect=$false},
  @{said="mom I'll eat in ten minutes"; circled=99; expect=$false},
  @{said="find the integral of x e to the x dx"; circled=99; expect=$false},
  @{said="hmm"; circled=99; expect=$false},
  @{said="ugh I hate this chapter"; circled=99; expect=$false},
  @{said="wait how do I choose u"; circled=99; expect=$true},
  @{said="so v is e to the x and du is dx"; circled=4; expect=$false},
  @{said="what comes next"; circled=99; expect=$true},
  @{said="question five evaluate the limit as x tends to zero"; circled=99; expect=$false}
)
$okCount = 0; $times = @()
foreach ($t in $tests) {
  $user = "said: `"$($t.said)`"`ncircled_seconds_ago: $($t.circled)`npen_moving: false`ntutor_just_spoke: false"
  $body = @{ model="qwen/qwen3.8-27b"; temperature=0; reasoning_effort="none"; response_format=@{type="json_object"};
             messages=@(@{role="system";content=$system}, @{role="user";content=$user}) } | ConvertTo-Json -Depth 5
  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-RestMethod "https://api.groq.com/openai/v1/chat/completions" -Method Post -Headers @{Authorization="Bearer $k"} -ContentType "application/json" -Body $body
    $sw.Stop(); $times += $sw.ElapsedMilliseconds
    $ans = $r.choices[0].message.content | ConvertFrom-Json
    $ok = if ($ans.for_me -eq $t.expect) {"OK  "; $okCount++} else {"MISS"}
    "{0} {1,5}ms  for_me={2,-5} '{3}'" -f $ok, $sw.ElapsedMilliseconds, $ans.for_me, $t.said
  } catch { "ERR  $($_.ErrorDetails.Message)  '$($t.said)'" }
}
"score: $okCount / $($tests.Count)   median: $(($times | Sort-Object)[[int]($times.Count/2)]) ms"
Remove-Variable k
```

Add new sentences to `$tests` as we collect real ones.
