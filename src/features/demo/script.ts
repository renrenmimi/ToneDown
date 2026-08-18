import type { FusionFrame } from '@/features/live-session/machine/sessionStore'
import type { SessionEvent } from '@/features/live-session/machine/sessionMachine'
import type { DebriefResponse } from '@/types/api'
import type { SessionRecord } from '@/shared/storage/records'
import type { Locale } from '@/shared/i18n/localeContext'

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

interface DemoScenario {
  opening: [string, string]
  quote: string
  rewrite: string
  riskKeywords: [string, string, string]
  mildRationale: string
  heatedRationale: string
  recoveryLine: string
  recoveryRationale: string
  closingLine: string
  settledRationale: string
  debrief: DebriefResponse
}

const SCENARIOS: Record<Locale, DemoScenario> = {
  'en-US': {
    opening: [
      'So about this weekend — I was thinking we could finally plan the trip.',
      'I just feel like every time we bring it up, something comes up.',
    ],
    quote: "You're late again! I'm sick of this! You always do this!",
    rewrite: "I've been waiting a while and I'm getting frustrated—could you message me earlier next time?",
    riskKeywords: ["You're late again", 'sick of this', 'you always'],
    mildRationale: 'Mild frustration creeping in.',
    heatedRationale: 'Hostile language is continuing to escalate.',
    recoveryLine: "Okay. You're right — let me slow down. I do want this trip to happen.",
    recoveryRationale: 'De-escalating and taking responsibility.',
    closingLine: "Okay, let's pick a new time. I'll make sure to leave early this time.",
    settledRationale: 'Warm and settled.',
    debrief: {
      summary:
        'A relaxed plan turned heated for a moment, but you caught it: one breath, one rewrite, and the conversation landed warmer than it started.',
      emotional_arc: 'Calm start, a sharp mid-session spike, then a steady glide back down.',
      trigger_moments: [
        {
          quote: "You're late again! I'm sick of this! You always do this!",
          why_it_escalated: '“You always” turns one late arrival into a character verdict.',
          better_phrasing: "I've been waiting a while and I'm getting frustrated—could you message me earlier next time?",
        },
      ],
      one_habit_to_practice:
        'Swap “you always” for one concrete, recent example — verdicts escalate, examples invite repair.',
    },
  },
  'zh-CN': {
    opening: [
      '说到这个周末——我在想，我们终于可以把旅行计划定下来了。',
      '我只是觉得每次聊到这件事，总会有别的事情冒出来。',
    ],
    quote: '你怎么又迟到了！烦死了！你总是这样！',
    rewrite: '等了你很久，我有点着急——下次能提前发个消息吗？',
    riskKeywords: ['你怎么又', '烦死了', '你总是'],
    mildRationale: '有一点不满开始显现。',
    heatedRationale: '敌意持续升级。',
    recoveryLine: '好吧，你说得对——我慢一点。我确实希望这次旅行能成行。',
    recoveryRationale: '正在降温并承担责任。',
    closingLine: '好，那我们重新约时间，这次我一定提前出门。',
    settledRationale: '语气回到平和。',
    debrief: {
      summary: '原本轻松的计划一度变得激烈，但你及时停了下来：一次呼吸、一次改写，让对话比开始时更温和。',
      emotional_arc: '平静开场，中段快速升温，随后稳定回落。',
      trigger_moments: [
        {
          quote: '你怎么又迟到了！烦死了！你总是这样！',
          why_it_escalated: '“你总是 / 你怎么又”把一次迟到上升成了对人的评判。',
          better_phrasing: '等了你很久，我有点着急——下次能提前发个消息吗？',
        },
      ],
      one_habit_to_practice: '把“你总是”换成一个具体、最近的例子——评判会升级冲突，事实更容易开启修复。',
    },
  },
}

export function buildDemoSteps(locale: Locale): TimedStep[] {
  const scenario = SCENARIOS[locale]
  const [riskOne, riskTwo] = scenario.riskKeywords

  return [
  {
    at: 0,
    run: (sink, now) => {
      sink.dispatch({ type: 'MIC_READY', at: now })
      sink.dispatch({ type: 'CALIBRATION_COMPLETE', at: now })
    },
  },
  { at: 1_500, run: (sink, now) => say(sink, now, scenario.opening[0]) },
  { at: 2_500, run: (sink, now) => score(sink, now, 27, { wordsPerMinute: 96, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'neutral', intensity: 18, rationale: 'Relaxed planning talk.', at: now } }) },
  { at: 5_500, run: (sink, now) => say(sink, now, scenario.opening[1]) },
  { at: 6_500, run: (sink, now) => score(sink, now, 41, { wordsPerMinute: 118, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'defensive', intensity: 42, rationale: scenario.mildRationale, at: now } }) },
  { at: 9_500, run: (sink, now) => say(sink, now, scenario.quote) },
  {
    at: 10_500,
    run: (sink, now) =>
      score(sink, now, 74, {
        wordsPerMinute: 208,
        speedLevel: 'fast',
        highRiskKeywords: scenario.riskKeywords,
        latestHighRiskKeyword: riskOne,
        fusionMode: 'llm',
        llmTone: { tone: 'aggressive', intensity: 82, rationale: scenario.heatedRationale, at: now },
      }),
  },
  {
    at: 12_000,
    run: (sink) => sink.setSuggestion({ original: scenario.quote, rewrite: scenario.rewrite }),
  },
  {
    at: 12_500,
    run: (sink, now) => {
      sink.dispatch({ type: 'REWRITE_OFFERED', moment: { at: now, quote: scenario.quote, rewrite: scenario.rewrite } })
      score(sink, now, 86, {
        wordsPerMinute: 224,
        speedLevel: 'very_fast',
        highRiskKeywords: scenario.riskKeywords,
        latestHighRiskKeyword: riskTwo,
        fusionMode: 'llm',
        llmTone: { tone: 'aggressive', intensity: 90, rationale: scenario.heatedRationale, at: now },
      })
    },
  },
  { at: 14_500, run: (sink, now) => score(sink, now, 88, { fusionMode: 'llm', llmTone: { tone: 'aggressive', intensity: 88, rationale: scenario.heatedRationale, at: now } }) },
  { at: 16_500, run: (sink, now) => score(sink, now, 84, { fusionMode: 'llm', llmTone: { tone: 'aggressive', intensity: 84, rationale: scenario.heatedRationale, at: now } }) },
  // ~17.5s: the machine's own sustain logic fires the intervention; the
  // breathing guide morphs in. The script lets it breathe for ~6s.
  { at: 24_000, run: (sink, now) => sink.dispatch({ type: 'INTERVENTION_ACKNOWLEDGED', at: now }) },
  { at: 24_500, run: (sink) => sink.setSuggestion(null) },
  // brief degradation cameo: the engine chip flips and recovers
  { at: 26_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'browser' }) },
  { at: 30_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'groq' }) },
  { at: 27_000, run: (sink, now) => say(sink, now, scenario.recoveryLine) },
  { at: 28_000, run: (sink, now) => score(sink, now, 52, { wordsPerMinute: 120, speedLevel: 'normal', highRiskKeywords: [], latestHighRiskKeyword: null, fusionMode: 'llm', llmTone: { tone: 'neutral', intensity: 40, rationale: scenario.recoveryRationale, at: now } }) },
  { at: 32_000, run: (sink, now) => say(sink, now, scenario.closingLine) },
  { at: 33_000, run: (sink, now) => score(sink, now, 34, { wordsPerMinute: 104, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'positive', intensity: 18, rationale: scenario.settledRationale, at: now } }) },
  { at: 38_000, run: (sink, now) => score(sink, now, 26, { wordsPerMinute: 92, speedLevel: 'normal', fusionMode: 'llm', llmTone: { tone: 'positive', intensity: 12, rationale: scenario.settledRationale, at: now } }) },
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
        language: locale,
        calmScore: 47,
        peakScore: 88,
        interventionCount: 1,
        scoreSeries: series,
        flaggedMoments: [{ atMs: 12_500, quote: scenario.quote, rewrite: scenario.rewrite }],
        debrief: null,
      }
      sink.setRecap({ ...record, debrief: scenario.debrief }, scenario.debrief)
    },
  },
  ]
}

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
