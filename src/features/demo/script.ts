import {
  BASE_SCORE,
  fuseScore,
  getSpeedBonus,
  getVolumeBonus,
  LEGACY_HIGH_RISK_WEIGHT,
  LLM_MAX_WEIGHT,
  LLM_MODE_HIGH_RISK_WEIGHT,
  TONE_MULTIPLIER,
} from '@/features/live-session/lib/fusion'
import type { FusionFrame } from '@/features/live-session/machine/sessionStore'
import type { SessionEvent } from '@/features/live-session/machine/sessionMachine'
import type { DebriefResponse, ToneLabel } from '@/types/api'
import type { SignalBreakdown, SpeedLevel } from '@/types/app'
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

/**
 * One scored moment of the script. Only the INPUTS are canned — the score is
 * produced by the same `fuseScore` the live loop runs, so the explanation
 * timeline's arithmetic reconciles here exactly as it does with a real mic.
 */
interface Beat {
  /** Where the ambient volume driver sits at this moment, 0-100. */
  volume: number
  wpm: number
  speed: SpeedLevel
  tone?: { label: ToneLabel; intensity: number; rationale: string }
  keywords?: string[]
}

function demoSignals(at: number, spec: Beat): SignalBreakdown {
  const volumeBonus = getVolumeBonus(spec.volume)
  const speedBonus = getSpeedBonus(spec.speed)
  const keywords = spec.keywords ?? []
  const { tone } = spec

  return {
    at,
    mode: tone ? 'llm' : 'rules',
    acoustic: {
      volume: spec.volume,
      volumeBonus,
      speedLevel: spec.speed,
      speedBonus,
      score: BASE_SCORE + volumeBonus + speedBonus,
    },
    semantic: {
      tone: tone?.label ?? null,
      intensity: tone?.intensity ?? 0,
      // Scripted analyses land on the beat, so they are always fully fresh.
      freshness: tone ? 1 : 0,
      weight: tone ? LLM_MAX_WEIGHT : 0,
      score: tone ? tone.intensity * TONE_MULTIPLIER[tone.label] : null,
      highRiskKeywords: keywords,
      mediumRiskKeywords: [],
      keywordBonus:
        keywords.length * (tone ? LLM_MODE_HIGH_RISK_WEIGHT : LEGACY_HIGH_RISK_WEIGHT),
      floorApplied: false,
    },
  }
}

function beat(sink: DemoSink, now: number, spec: Beat) {
  const signals = demoSignals(now, spec)
  const { score, floorApplied } = fuseScore(signals)
  const resolved = floorApplied
    ? { ...signals, semantic: { ...signals.semantic, floorApplied: true } }
    : signals
  const frame: Partial<FusionFrame> = {
    wordsPerMinute: spec.wpm,
    speedLevel: spec.speed,
    highRiskKeywords: spec.keywords ?? [],
    latestHighRiskKeyword: spec.keywords?.[0] ?? null,
    fusionMode: resolved.mode,
    llmTone: spec.tone
      ? {
          tone: spec.tone.label,
          intensity: spec.tone.intensity,
          rationale: spec.tone.rationale,
          at: now,
        }
      : null,
  }

  sink.setFrame({ score, ...frame })
  sink.dispatch({ type: 'SCORE_UPDATED', score, level: level(score), at: now, signals: resolved })
}

interface DemoScenario {
  opening: [string, string]
  quote: string
  rewrite: string
  riskKeywords: [string, string, string]
  openingRationale: string
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
    openingRationale: 'Relaxed planning talk.',
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
    openingRationale: '轻松的计划闲聊。',
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
  const hostile = (intensity: number) => ({
    label: 'aggressive' as const,
    intensity,
    rationale: scenario.heatedRationale,
  })
  // Volumes track VOLUME_KEYFRAMES at each beat, so the explanation card and
  // the volume meter tell the same story.

  return [
  {
    at: 0,
    run: (sink, now) => {
      sink.dispatch({ type: 'MIC_READY', at: now })
      sink.dispatch({ type: 'CALIBRATION_COMPLETE', at: now })
      // Every beat carries a tone read, so the dashboard chip has to say so.
      sink.dispatch({ type: 'ANALYSIS_MODE_CHANGED', mode: 'llm' })
    },
  },
  { at: 1_500, run: (sink, now) => say(sink, now, scenario.opening[0]) },
  {
    at: 2_500,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 25,
        wpm: 96,
        speed: 'normal',
        tone: { label: 'neutral', intensity: 18, rationale: scenario.openingRationale },
      }),
  },
  { at: 5_500, run: (sink, now) => say(sink, now, scenario.opening[1]) },
  {
    at: 6_500,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 38,
        wpm: 118,
        speed: 'normal',
        tone: { label: 'defensive', intensity: 42, rationale: scenario.mildRationale },
      }),
  },
  { at: 9_500, run: (sink, now) => say(sink, now, scenario.quote) },
  {
    at: 10_500,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 64,
        wpm: 208,
        speed: 'fast',
        tone: hostile(82),
        keywords: scenario.riskKeywords,
      }),
  },
  {
    at: 12_000,
    run: (sink) => sink.setSuggestion({ original: scenario.quote, rewrite: scenario.rewrite }),
  },
  {
    at: 12_500,
    run: (sink, now) => {
      // Score first, then the rewrite: the live app offers a rewrite off the
      // latest tick, and the reminder records that tick as its justification.
      beat(sink, now, {
        volume: 72,
        wpm: 224,
        speed: 'very_fast',
        tone: hostile(90),
        keywords: scenario.riskKeywords,
      })
      sink.dispatch({
        type: 'REWRITE_OFFERED',
        moment: { at: now, quote: scenario.quote, rewrite: scenario.rewrite },
      })
    },
  },
  {
    at: 14_500,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 77,
        wpm: 224,
        speed: 'very_fast',
        tone: hostile(88),
        keywords: scenario.riskKeywords,
      }),
  },
  {
    at: 16_500,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 75,
        wpm: 224,
        speed: 'very_fast',
        tone: hostile(84),
        keywords: scenario.riskKeywords,
      }),
  },
  // ~16s: the machine's own sustain logic fires the intervention on the first
  // heartbeat 5s past the 70-crossing at 10.5s. It holds until the ack at 24s.
  { at: 24_000, run: (sink, now) => sink.dispatch({ type: 'INTERVENTION_ACKNOWLEDGED', at: now }) },
  { at: 24_500, run: (sink) => sink.setSuggestion(null) },
  // brief degradation cameo: the engine chip flips and recovers
  { at: 26_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'browser' }) },
  { at: 30_000, run: (sink) => sink.dispatch({ type: 'STT_ENGINE_CHANGED', engine: 'groq' }) },
  { at: 27_000, run: (sink, now) => say(sink, now, scenario.recoveryLine) },
  {
    at: 28_000,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 41,
        wpm: 120,
        speed: 'normal',
        tone: { label: 'neutral', intensity: 40, rationale: scenario.recoveryRationale },
      }),
  },
  { at: 32_000, run: (sink, now) => say(sink, now, scenario.closingLine) },
  {
    at: 33_000,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 32,
        wpm: 104,
        speed: 'normal',
        tone: { label: 'positive', intensity: 18, rationale: scenario.settledRationale },
      }),
  },
  {
    at: 38_000,
    run: (sink, now) =>
      beat(sink, now, {
        volume: 26,
        wpm: 92,
        speed: 'normal',
        tone: { label: 'positive', intensity: 12, rationale: scenario.settledRationale },
      }),
  },
  {
    at: 42_000,
    run: (sink, now) => {
      sink.dispatch({ type: 'STOP_REQUESTED', at: now })
      const startedAt = now - 42_000
      const series: [number, number][] = [
        [0, 14], [2_500, 14], [6_500, 32], [10_500, 85], [12_500, 94], [14_500, 93],
        [16_500, 90], [20_000, 74], [24_000, 46], [28_000, 21], [33_000, 16], [38_000, 12],
      ]
      const record: SessionRecord = {
        startedAt,
        endedAt: now,
        durationMs: 42_000,
        language: locale,
        calmScore: 51,
        peakScore: 94,
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
