import type { FusionFrame } from '@/features/live-session/machine/sessionStore'
import type { SessionEvent } from '@/features/live-session/machine/sessionMachine'
import type { DebriefResponse } from '@/types/api'
import type { SessionRecord } from '@/shared/storage/records'

// The scripted bilingual session: ~46s of canned events replayed through the
// REAL session machine and UI components — zero microphone, zero network,
// zero tokens. Interviewers see the whole product in under a minute.

export interface DemoSink {
  dispatch: (event: SessionEvent) => void
  setVolume: (v: number) => void
  setFrame: (frame: Partial<FusionFrame> & { score: number }) => void
  setSuggestion: (s: { original: string; rewrite: string } | null) => void
  setRecap: (record: SessionRecord, debrief: DebriefResponse) => void
}

interface TimedStep {
  at: number
  run: (sink: DemoSink, now: number) => void
}

/** Volume keyframes [seconds, baseLevel] — the ambient driver interpolates. */
export const VOLUME_KEYFRAMES: [number, number][] = [
  [0, 18],
  [6, 35],
  [10, 62],
  [14, 78],
  [20, 72],
  [26, 45],
  [34, 30],
  [42, 22],
]

export const DEMO_DURATION_MS = 46_000

const level = (score: number) =>
  score <= 30 ? ('calm' as const) : score <= 55 ? ('elevated' as const) : score <= 75 ? ('heated' as const) : ('critical' as const)

function say(sink: DemoSink, now: number, text: string) {
  sink.dispatch({ type: 'TRANSCRIPT_FINALIZED', entries: [{ text, timestamp: now, source: 'groq' }] })
}

function score(
  sink: DemoSink,
  now: number,
  value: number,
  frame: Partial<FusionFrame> = {},
) {
  sink.setFrame({ score: value, ...frame })
  sink.dispatch({ type: 'SCORE_UPDATED', score: value, level: level(value), at: now })
}

const ZH_QUOTE = '你怎么又迟到了！烦死了！你总是这样！'
const ZH_REWRITE = '等了你很久，我有点着急——下次能提前发个消息吗？'

export const DEMO_STEPS: TimedStep[] = [
  {
    at: 0,
    run: (sink, now) => {
      sink.dispatch({ type: 'MIC_READY', at: now })
      sink.dispatch({ type: 'CALIBRATION_COMPLETE', at: now })
    },
  },
  { at: 1_500, run: (sink, now) => say(sink, now, "So about this weekend — I was thinking we could finally plan the trip.") },
  { at: 2_500, run: (sink, now) => score(sink, now, 27, { wordsPerMinute: 96, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'neutral', intensity: 18, rationale: 'Relaxed planning talk.', at: now } }) },
  { at: 5_500, run: (sink, now) => say(sink, now, 'I just feel like every time we bring it up, something comes up.') },
  { at: 6_500, run: (sink, now) => score(sink, now, 41, { wordsPerMinute: 118, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'defensive', intensity: 42, rationale: 'Mild frustration creeping in.', at: now } }) },
  { at: 9_500, run: (sink, now) => say(sink, now, ZH_QUOTE) },
  {
    at: 10_500,
    run: (sink, now) =>
      score(sink, now, 74, {
        wordsPerMinute: 208,
        speedLevel: 'fast',
        highRiskKeywords: ['你怎么又', '烦死了', '你总是'],
        latestHighRiskKeyword: '你怎么又',
        fusionMode: 'llm',
        llmTone: { tone: 'aggressive', intensity: 82, rationale: '连续使用指责性语言。', at: now },
      }),
  },
  {
    at: 12_000,
    run: (sink) => sink.setSuggestion({ original: ZH_QUOTE, rewrite: ZH_REWRITE }),
  },
  {
    at: 12_500,
    run: (sink, now) => {
      sink.dispatch({ type: 'REWRITE_OFFERED', moment: { at: now, quote: ZH_QUOTE, rewrite: ZH_REWRITE } })
      score(sink, now, 86, {
        wordsPerMinute: 224,
        speedLevel: 'very_fast',
        highRiskKeywords: ['你怎么又', '烦死了', '你总是'],
        latestHighRiskKeyword: '烦死了',
        fusionMode: 'llm',
        llmTone: { tone: 'aggressive', intensity: 90, rationale: '敌意持续升级。', at: now },
      })
    },
  },
  { at: 14_500, run: (sink, now) => score(sink, now, 88, { fusionMode: 'llm', llmTone: { tone: 'aggressive', intensity: 88, rationale: '敌意持续升级。', at: now } }) },
  { at: 16_500, run: (sink, now) => score(sink, now, 84, { fusionMode: 'llm', llmTone: { tone: 'aggressive', intensity: 84, rationale: '敌意持续升级。', at: now } }) },
  // ~17.5s: the machine's own sustain logic fires the intervention; the
  // breathing guide morphs in. The script lets it breathe for ~6s.
  { at: 24_000, run: (sink, now) => sink.dispatch({ type: 'INTERVENTION_ACKNOWLEDGED', at: now }) },
  { at: 24_500, run: (sink) => sink.setSuggestion(null) },
  // brief degradation cameo: the engine chip flips and recovers
  { at: 26_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'browser' }) },
  { at: 30_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'groq' }) },
  { at: 27_000, run: (sink, now) => say(sink, now, "Okay. You're right — let me slow down. I do want this trip to happen.") },
  { at: 28_000, run: (sink, now) => score(sink, now, 52, { wordsPerMinute: 120, speedLevel: 'normal', highRiskKeywords: [], latestHighRiskKeyword: null, fusionMode: 'llm', llmTone: { tone: 'neutral', intensity: 40, rationale: 'De-escalating, taking responsibility.', at: now } }) },
  { at: 32_000, run: (sink, now) => say(sink, now, '好，那我们重新约时间，这次我一定提前出门。') },
  { at: 33_000, run: (sink, now) => score(sink, now, 34, { wordsPerMinute: 104, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'positive', intensity: 18, rationale: '语气回到平和。', at: now } }) },
  { at: 38_000, run: (sink, now) => score(sink, now, 26, { wordsPerMinute: 92, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'positive', intensity: 12, rationale: 'Warm and settled.', at: now } }) },
  {
    at: 42_000,
    run: (sink, now) => {
      sink.dispatch({ type: 'STOP_REQUESTED', at: now })
      const startedAt = now - 42_000
      const series: [number, number][] = [
        [0, 27], [4_000, 30], [7_000, 41], [10_500, 74], [12_500, 86], [14_500, 88],
        [16_500, 84], [20_000, 70], [24_000, 58], [28_000, 52], [33_000, 34], [40_000, 26],
      ]
      const record: SessionRecord = {
        startedAt,
        endedAt: now,
        durationMs: 42_000,
        language: 'en-US',
        calmScore: 47,
        peakScore: 88,
        interventionCount: 1,
        scoreSeries: series,
        flaggedMoments: [{ atMs: 12_500, quote: ZH_QUOTE, rewrite: ZH_REWRITE }],
        debrief: null,
      }
      const debrief: DebriefResponse = {
        summary:
          'A relaxed plan turned heated for a moment, but you caught it: one breath, one rewrite, and the conversation landed warmer than it started.',
        emotional_arc: 'Calm start, a sharp mid-session spike, then a steady glide back down.',
        trigger_moments: [
          {
            quote: ZH_QUOTE,
            why_it_escalated: '「你总是 / 你怎么又」 turns one late arrival into a character verdict.',
            better_phrasing: ZH_REWRITE,
          },
        ],
        one_habit_to_practice: 'Swap "you always" for one concrete, recent example — verdicts escalate, examples invite repair.',
      }
      sink.setRecap({ ...record, debrief }, debrief)
    },
  },
]

export function volumeBaseAt(elapsedMs: number): number {
  const t = elapsedMs / 1000
  for (let i = VOLUME_KEYFRAMES.length - 1; i >= 0; i -= 1) {
    const [t0, v0] = VOLUME_KEYFRAMES[i]
    if (t >= t0) {
      const next = VOLUME_KEYFRAMES[i + 1]
      if (!next) {
        return v0
      }
      const [t1, v1] = next
      return v0 + ((t - t0) / (t1 - t0)) * (v1 - v0)
    }
  }
  return VOLUME_KEYFRAMES[0][1]
}
