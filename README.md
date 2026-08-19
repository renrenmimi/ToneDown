# ToneDown

A bilingual tone-coaching web application for practicing calmer communication. It combines acoustic measurements with language analysis, suggests alternative phrasing, and provides a local session review.

**Live:** https://tone-down.vercel.app  
**Guided demo:** https://tone-down.vercel.app/demo

![The live session with tone indicators and rewrite suggestions](docs/screenshot.jpg)

## Main areas

| Route | Purpose |
| --- | --- |
| `/app` | Live tone feedback, rewrite suggestions, and a breathing prompt |
| `/demo` | Scripted walkthrough that does not require a microphone |
| `/spar` | De-escalation practice with six conversation personas |
| `/gym` | Short daily rewriting exercises |
| `/history` | Local session history, trends, export, and deletion |

## How it works

- Browser audio APIs measure volume and collect short transcription segments.
- A typed state machine coordinates calibration, listening, escalation, intervention, and recap states.
- A two-second scoring loop combines available acoustic and language signals.
- Server functions keep model credentials off the client and validate structured responses.
- IndexedDB stores session history locally.

When a model or transcription service is unavailable, the application falls back to browser speech recognition or local rules where possible. The guided demo remains network-free.

## Privacy

Audio is processed for the active session and is not stored by the application. Session history remains in the browser unless the user exports it. Server logs contain request metadata rather than conversation content.

## Running locally

```bash
npm install
cp .env.example .env
npm run dev:full
```

`npm run dev` starts the client only; API-dependent features then use their fallback states. See [TESTING.md](TESTING.md) for route checks and manual bilingual test cases.

## Validation

- Vitest covers score calculation, state transitions, model budgets, circuit breakers, and response guards.
- Playwright checks the production demo without allowing API requests.
- GitHub Actions runs type checking, linting, unit tests, builds, end-to-end smoke tests, and secret scanning.

ToneDown is a communication aid, not counseling or professional advice.

