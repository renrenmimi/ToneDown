# ToneDown manual test guide

## Prerequisites

```bash
npm install
cp .env.example .env        # paste your Groq API key into .env (gitignored)
npm run dev:full            # API adapter on :3001 + Vite on :5173
```

Open http://localhost:5173 in Chrome (or Edge). All endpoint checks below also
work through the Vite proxy (`:5173/api/...`).

## 1. Per-route curl checks

**/api/transcribe** — needs a real audio file. On macOS, synthesize one:

```bash
say -o /tmp/en.aiff "You never listen to me. I am done with this conversation."
afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/en.aiff /tmp/en.wav

curl -s -X POST 'http://localhost:3001/api/transcribe?lang=en' \
  -H 'Content-Type: application/octet-stream' -H 'x-audio-mime: audio/wav' \
  --data-binary @/tmp/en.wav
# → {"transcript":"You never listen to me, I am done with this conversation.","language":"en"}

# Chinese variant (voice name must include the language qualifier):
say -v "Eddy (Chinese (China mainland))" -o /tmp/zh.aiff "你怎么又迟到了，烦死了，你总是这样"
afconvert -f WAVE -d LEI16@16000 -c 1 /tmp/zh.aiff /tmp/zh.wav
curl -s -X POST 'http://localhost:3001/api/transcribe?lang=zh' \
  -H 'Content-Type: application/octet-stream' -H 'x-audio-mime: audio/wav' \
  --data-binary @/tmp/zh.wav
# → {"transcript":"你怎么又迟到了,烦死了,你总是这样。","language":"zh"}
```

**/api/analyze**:

```bash
curl -s -X POST http://localhost:3001/api/analyze -H 'Content-Type: application/json' \
  -d '{"text":"你怎么又迟到了 烦死了 你总是这样","context":["我们说好七点见面的"],"language":"zh-CN"}'
# → {"tone":"aggressive","intensity":~80,"rationale":"<one zh sentence>"}
```

**/api/rewrite**:

```bash
curl -s -X POST http://localhost:3001/api/rewrite -H 'Content-Type: application/json' \
  -d '{"utterance":"you never listen to me, I am done","context":["we talked about this yesterday"],"language":"en-US"}'
# → {"rewrite":"<constructive English alternative>"}
```

**Abuse-protection negative paths**:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001/api/analyze            # GET → 405
head -c 2000000 /dev/zero > /tmp/big.bin
curl -s -X POST http://localhost:3001/api/transcribe -H 'Content-Type: application/octet-stream' \
  -H 'x-audio-mime: audio/webm' --data-binary @/tmp/big.bin -w ' %{http_code}\n'       # → 413
for i in $(seq 1 13); do curl -s -o /dev/null -w '%{http_code} ' -X POST \
  http://localhost:3001/api/rewrite -H 'Content-Type: application/json' -d '{"bad":1}'; done; echo
# → ten 400s then 429s with a Retry-After header (rewrite limit: 10/min/IP)
```

## 2. Bilingual manual script (speak into the mic)

Speak each line, then watch for the expected result. The tone score updates
every 2s; LLM analysis lands ~1-2s after each ~4s speech segment.

| # | Mode | Say | Expect |
|---|------|-----|--------|
| 1 | 中 | (calm, normal volume) “今天天气不错，晚上想吃什么？” | Score stays ≤ ~40 (calm/elevated), badge **Groq 语音识别**, tone line shows *neutral/positive* + zh rationale |
| 2 | 中 | (loud, fast) “你怎么又迟到了！烦死了！你总是这样！” | Transcript shows the line; tone line flips to *aggressive*; score climbs > 70; after ~5s sustained: CalmReminder modal + **AI 建议** card with a Chinese rewrite |
| 3 | EN | (calm) “The weather is lovely today, want to take a walk?” | Score relaxes back ≤ ~40 within ~20s (LLM freshness decay), tone *positive* |
| 4 | EN | (loud) “You never listen to me, I'm done with this!” | *aggressive* tone, score > 70, English **AI suggestion** card (NVC-style rewrite) |
| 5 | any | Laugh / talk loudly but friendly | Score stays moderate — fresh LLM *positive/neutral* suppresses the volume false-positive (rules-only would have scored ~60) |
| 6 | any | Stay silent 60s | No new transcript entries (silence gate + hallucination filter), score decays to ~30 |

## 3. Degradation drills

1. **LLM offline**: DevTools → Network → add blocking pattern `*/api/*` while
   monitoring. Within ~12s (3 failed 4s segments) the badge flips to
   **Browser STT** and the **LLM offline · rules mode** chip appears; the
   transcript keeps flowing via Web Speech and scoring continues (legacy
   keyword/volume formula). Suggestions fall back to the static map.
2. **Recovery**: remove the block. The transcriber probes on the circuit
   breaker's backoff (30s, then 60s, 120s… capped at 5min); on the first
   successful probe the badge returns to **Groq Whisper** (the probe's
   transcript is discarded to avoid duplicating Web Speech's).
3. **Rules-only dev mode**: run plain `npm run dev` (no API server) — the app
   must behave like the original rules-only build end-to-end.

## 4. Latency measurement

Dev builds log every pipeline leg and keep samples on `window.__toneDownLatency`
(`{ transcribe: [...], analyze: [...], rewrite: [...] }`, ms). After a couple of
minutes of talking, read p50s from the DevTools console:

```js
Object.fromEntries(Object.entries(window.__toneDownLatency).map(([k, v]) =>
  [k, v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)] + 'ms p50']))
```

End-of-speech → updated tone score =
`transcribe RTT + 600ms debounce + analyze RTT + 0–2s scoring tick`
(the ~4s segment length adds up to 4s between a spoken phrase and its
segment's end; see README for the chosen tradeoff).
