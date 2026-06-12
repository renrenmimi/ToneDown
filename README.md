# ToneDown

A bilingual (中文 / English) PWA that listens to a live conversation and helps de-escalate it: real-time tone scoring, calm-down reminders, and constructive rephrasing suggestions.

## Architecture

- **Client** (Vite + React 19 + TS): captures mic audio, fuses three signals into a 0–100 tension score every 2s — amplitude (100ms RMS), speech rate (10s window), and semantic tone from an LLM. Falls back to a local keyword lexicon when offline.
- **Serverless proxy** (`api/`, Vercel functions): holds the Groq API key server-side.
  - `POST /api/transcribe` — audio chunk → Groq Whisper (`whisper-large-v3-turbo`) → `{ transcript, language }`
  - `POST /api/analyze` — transcript window → Groq chat (`llama-3.3-70b-versatile`) → `{ tone, intensity, rationale }`
  - `POST /api/rewrite` — hostile utterance + context → constructive rephrasing in the same language
- **STT**: MediaRecorder segments (~4s) → `/api/transcribe`; automatic fallback to the browser's Web Speech API when the proxy is unreachable (visible engine indicator).

## Setup

```bash
npm install
cp .env.example .env   # then paste your Groq API key into .env
```

`GROQ_API_KEY` lives only in the gitignored `.env` locally and in the Vercel project's environment variables in production. It must never appear in client code or the repo.

## Local development

```bash
npm run dev:full   # Vite on :5173 + local API runtime on :3001 (Vite proxies /api there)
```

- `npm run dev:api` — just the API routes (a small Node adapter, `scripts/dev-api.mjs`, that mimics Vercel's runtime so no `vercel login` is needed).
- `npm run dev` — just the client; `/api/*` will fail, which exercises the rules-only degraded mode.
- `vercel dev` also works (closest to production) once you've run `vercel login` and linked the project.

## Abuse protection

All routes reject non-POST requests, cap payload size (1.5MB audio / 16KB JSON), and rate-limit per IP with a 60s sliding window (30/min transcribe & analyze, 10/min rewrite). The limiter is in-memory per warm serverless instance — adequate for a public demo, not a hard guarantee across instances.

## Robustness

- Every Groq call has an AbortController timeout; the UI never blocks on the LLM.
- LLM output is schema-validated; malformed JSON gets one corrective retry, then the client falls back to local rules.
- With the network down the app still works end-to-end in rules-only mode (keyword lexicon + amplitude + speech rate, static suggestions).

See `TESTING.md` for manual test scripts and per-route curl checks.
