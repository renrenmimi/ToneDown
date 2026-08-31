import { createI18n } from '@/shared/i18n/createI18n'
import type { ToneLabel } from '@/types/api'
import type { EmotionLevel, SpeedLevel } from '@/types/app'
import type { ReminderKind, TriggerDriver } from './lib/explain'

interface LiveSessionStrings {
  subtitle: string
  themeToggle: string
  historyLink: string
  sparringLink: string
  gymLink: string
  intro: string
  start: string
  stop: string
  listeningTime: string
  dashboard: string
  transcript: string
  engineGroq: string
  engineBrowser: string
  sttUnavailable: string
  rulesMode: string
  toneSuggestion: string
  toneSuggestionHint: string
  toneSuggestionEmpty: string
  toneSuggestionDetected: string
  ribbon: {
    label: string
    now: string
    flagged: string
    offered: string
    close: string
  }
  notSupported: string
  permissionDenied: string
  metrics: {
    volume: string
    speed: string
    trend: string
  }
  trend: {
    up: string
    down: string
    flat: string
  }
  speedLabel: Record<SpeedLevel, string>
  speedUnit: string
  interim: string
  emptyTranscript: string
  emotionState: Record<EmotionLevel, string>
  gauge: {
    volumeRing: string
    rateRing: string
    semanticRing: string
    bandWord: Record<EmotionLevel, string>
  }
  disclaimer: string
  suggestion: {
    original: string
    suggestion: string
    aiBadge: string
  }
  onboarding: {
    ariaLabel: string
    skip: string
    next: string
    done: string
    one: { emoji: string; title: string; body: string }
    two: { emoji: string; title: string; body: string }
    three: { emoji: string; title: string; body: string }
  }
  breath: {
    title: string
    inhale: string
    hold: string
    exhale: string
    steady: string
    fallback: string
  }
  explain: {
    title: string
    hint: string
    chartLabel: string
    axisStart: string
    axisEnd: string
    trackAcoustic: string
    trackAcousticHint: string
    trackSemantic: string
    trackSemanticHint: string
    keywordTick: string
    keywordSeparator: string
    lexiconOnly: string
    empty: string
    kind: Record<ReminderKind, string>
    heading: (index: number, clock: string) => string
    rule: Record<ReminderKind, string>
    scoreAtTrigger: (score: number) => string
    driverLabel: string
    driver: Record<TriggerDriver, string>
    acousticLine: (volume: number, speed: string, points: string) => string
    semanticLine: (tone: string, intensity: number, points: string) => string
    semanticIdleLine: string
    keywordLine: (keywords: string, points: string) => string
    keywordNone: string
    floorNote: string
    shareLabel: string
    quoteLabel: string
    noSignals: string
    tone: Record<ToneLabel, string>
  }
}

export const { useT: useLiveSessionT, t: liveSessionT } = createI18n<LiveSessionStrings>({
  'zh-CN': {
    subtitle: '情侣语气检测助手',
    themeToggle: '切换深浅色主题',
    historyLink: '查看历史',
    sparringLink: '对练场',
    gymLink: '语气健身房',
    intro: '实时检测你的语气强度，帮助你把对话拉回冷静区。',
    start: '开始检测',
    stop: '停止',
    listeningTime: '录音时长',
    dashboard: '实时情绪仪表盘',
    transcript: '实时语音转文字',
    engineGroq: 'Groq 语音识别',
    engineBrowser: '浏览器识别',
    sttUnavailable: '语音转写暂时不可用，仅基于音量评分。',
    rulesMode: 'AI 在休息 · 规则模式',
    toneSuggestion: 'AI 语气建议',
    toneSuggestionHint: '这句有点冲哦？下方会自动递上一个更温和的说法。',
    toneSuggestionEmpty: '当前未检测到高危关键词。',
    toneSuggestionDetected: '检测到的关键词',
    ribbon: {
      label: '本次对话时间线（最近 10 分钟）',
      now: '现在',
      flagged: '被标记的瞬间',
      offered: '当时建议的说法',
      close: '关闭',
    },
    notSupported: '请使用 Chrome 或 Edge 浏览器以获得最佳体验',
    permissionDenied: '麦克风权限被拒绝，请在浏览器设置中允许麦克风后重试。',
    metrics: {
      volume: '音量',
      speed: '语速',
      trend: '趋势',
    },
    trend: {
      up: '上升',
      down: '下降',
      flat: '平稳',
    },
    speedLabel: {
      slow: '偏慢',
      normal: '正常',
      fast: '偏快',
      very_fast: '很快',
    },
    speedUnit: '字/分',
    interim: '识别中',
    emptyTranscript: '说点什么吧——我们洗耳恭听（也只是听听而已）。',
    emotionState: {
      calm: '一切平和',
      elevated: '语气有些激动',
      heated: '情绪正在升温',
      critical: '需要冷静一下',
    },
    gauge: {
      volumeRing: '音量环 — 你现在听起来有多响',
      rateRing: '语速环 — 你说话有多快',
      semanticRing: '语义环 — AI 听出的敌意强度',
      bandWord: { calm: '平和', elevated: '紧绷', heated: '升温', critical: '过激' },
    },
    disclaimer: '本工具仅为沟通辅助，不提供心理咨询服务',
    suggestion: {
      original: '原话',
      suggestion: '建议',
      aiBadge: 'AI 建议',
    },
    onboarding: {
      ariaLabel: '新手引导',
      skip: '跳过',
      next: '下一步',
      done: '明白了',
      one: {
        emoji: '👂',
        title: '它倾听，但从不录音',
        body: '声音只在分析的瞬间经过，随即丢弃。历史只存在这台设备的浏览器里。麦克风只会在你按下「开始检测」时才请求。',
      },
      two: {
        emoji: '🎯',
        title: '你的语气，实时打分',
        body: '音量、语速和 AI 语义每 2 秒融合成一个分数。深红色只代表敌意——你会很少看到它，这是刻意的。',
      },
      three: {
        emoji: '🌊',
        title: '说急了的话，可以重来',
        body: '带刺的句子会得到一个更温和的版本；持续升温时，仪表盘会变成一次 4-7-8 呼吸练习。',
      },
    },
    breath: {
      title: '我们一起深呼吸一次',
      inhale: '吸气',
      hold: '屏住',
      exhale: '缓缓呼出',
      steady: '我稳住了',
      fallback: '一次呼吸之后，话会说得更好。',
    },
    explain: {
      title: '解释时间轴',
      hint: '两路信号分开画：麦克风听到的，和话里的意思。每个标记都是一次提醒——点开看它当时为什么触发。',
      chartLabel: '声学与语义信号时间轴',
      axisStart: '开始',
      axisEnd: '现在',
      trackAcoustic: '声学信号 · 音量与语速',
      trackAcousticHint: '读的是波形，不看内容。',
      trackSemantic: '语义信号 · AI 语气与关键词',
      trackSemanticHint: '读的是转写文本：AI 的语气判断，加上本地关键词。',
      keywordTick: '命中关键词',
      keywordSeparator: '、',
      lexiconOnly: '规则模式',
      empty: '这次对话还没有触发提醒。两条信号会一直画下去。',
      kind: {
        breathing: '呼吸暂停',
        rewrite: '换个说法',
      },
      heading: (index, clock) => `第 ${index} 次提醒 · ${clock}`,
      rule: {
        breathing: '触发规则：融合分数 ≥ 70，并持续 5 秒。',
        rewrite: '触发规则：出现高危措辞，或分数 ≥ 70 持续 5 秒。',
      },
      scoreAtTrigger: (score) => `当时分数 ${score}`,
      driverLabel: '主要驱动',
      driver: {
        acoustic: '声学信号（音量 / 语速）',
        semantic: 'AI 语义判断',
        keyword: '高危措辞',
        combined: '声学与语义共同推高',
      },
      acousticLine: (volume, speed, points) => `音量 ${volume}%，语速${speed} → ${points} 分`,
      semanticLine: (tone, intensity, points) =>
        `AI 判定「${tone}」，强度 ${intensity} → ${points} 分`,
      semanticIdleLine: 'AI 在休息，这一拍只有本地关键词在说话。',
      keywordLine: (keywords, points) => `命中措辞：${keywords} → ${points} 分`,
      keywordNone: '没有命中高危措辞。',
      floorNote: '安静但有敌意：语义下限把分数抬到了 72。',
      shareLabel: '各路信号的占比',
      quoteLabel: '当时那句',
      noSignals: '这次提醒早于第一次打分，没有可展示的信号。',
      tone: {
        aggressive: '有攻击性',
        'passive-aggressive': '阴阳怪气',
        defensive: '防御',
        neutral: '中性',
        positive: '友善',
      },
    },
  },
  'en-US': {
    subtitle: 'Couple Tone Tracking Assistant',
    themeToggle: 'Toggle light/dark theme',
    historyLink: 'View history',
    sparringLink: 'Sparring mode',
    gymLink: 'Tone Gym',
    intro: 'Track your tone in real time and bring conversations back to calm.',
    start: 'Start Detection',
    stop: 'Stop',
    listeningTime: 'Recording time',
    dashboard: 'Live Emotion Dashboard',
    transcript: 'Live Speech Transcript',
    engineGroq: 'Groq Whisper',
    engineBrowser: 'Browser STT',
    sttUnavailable: 'Speech transcription is temporarily unavailable; scoring on volume only.',
    rulesMode: 'AI resting · rules mode',
    toneSuggestion: 'AI Tone Suggestions',
    toneSuggestionHint:
      'That one came in a little hot? A calmer take appears down here automatically.',
    toneSuggestionEmpty: 'No high-risk keyword detected at the moment.',
    toneSuggestionDetected: 'Detected keywords',
    ribbon: {
      label: 'Session timeline (last 10 minutes)',
      now: 'now',
      flagged: 'Flagged moment',
      offered: 'Offered instead',
      close: 'Close',
    },
    notSupported: 'Please use Chrome or Edge for the best experience',
    permissionDenied: 'Microphone access was denied. Please allow it in browser settings.',
    metrics: {
      volume: 'Volume',
      speed: 'Speed',
      trend: 'Trend',
    },
    trend: {
      up: 'Rising',
      down: 'Cooling',
      flat: 'Steady',
    },
    speedLabel: {
      slow: 'slow',
      normal: 'normal',
      fast: 'fast',
      very_fast: 'very fast',
    },
    speedUnit: 'wpm',
    interim: 'Listening',
    emptyTranscript: "Say something — we're all ears (and only ears).",
    emotionState: {
      calm: 'Everything is calm',
      elevated: 'Tone is getting tense',
      heated: 'Emotion is rising',
      critical: 'Time to cool down',
    },
    gauge: {
      volumeRing: 'Loudness — how loud you sound right now',
      rateRing: 'Pace — how fast you are speaking',
      semanticRing: 'Meaning — AI-heard hostility intensity',
      bandWord: { calm: 'Calm', elevated: 'Tense', heated: 'Heated', critical: 'Hostile' },
    },
    disclaimer: 'This tool is for communication support only and is not counseling.',
    suggestion: {
      original: 'Original',
      suggestion: 'Suggestion',
      aiBadge: 'AI suggestion',
    },
    onboarding: {
      ariaLabel: 'First-visit introduction',
      skip: 'Skip',
      next: 'Next',
      done: 'Got it',
      one: {
        emoji: '👂',
        title: 'It listens. It never records.',
        body: 'Audio is scored in flight and discarded. Your history lives only in this browser. The mic is requested only when you press Start.',
      },
      two: {
        emoji: '🎯',
        title: 'Your tone, scored live',
        body: 'Loudness, pace, and AI meaning fuse into one score every 2 seconds. Crimson means hostility — you will see it rarely, on purpose.',
      },
      three: {
        emoji: '🌊',
        title: 'Hot moments get a redo',
        body: 'Spiky sentences get a calmer version; sustained heat morphs the gauge into one 4-7-8 breath.',
      },
    },
    breath: {
      title: "Let's take one together",
      inhale: 'Breathe in',
      hold: 'Hold',
      exhale: 'Let it go',
      steady: "I'm steady",
      fallback: "You're one breath away from a better sentence.",
    },
    explain: {
      title: 'Explanation timeline',
      hint: 'Two signals, drawn apart: what the microphone heard and what the words meant. Each marker is a reminder — open one to see why it fired.',
      chartLabel: 'Acoustic and semantic signal timeline',
      axisStart: 'start',
      axisEnd: 'now',
      trackAcoustic: 'Acoustic · loudness and pace',
      trackAcousticHint: 'Read from the waveform; it never looks at content.',
      trackSemantic: 'Semantic · AI tone and keywords',
      trackSemanticHint: 'Read from the transcript: the AI tone call plus the local lexicon.',
      keywordTick: 'keyword hit',
      keywordSeparator: ', ',
      lexiconOnly: 'rules mode',
      empty: 'No reminder has fired yet. Both signals keep drawing regardless.',
      kind: {
        breathing: 'Breathing pause',
        rewrite: 'Rewrite offer',
      },
      heading: (index, clock) => `Reminder ${index} · ${clock}`,
      rule: {
        breathing: 'Rule: the fused score stayed at 70 or above for 5 seconds.',
        rewrite: 'Rule: a high-risk phrase landed, or the score held at 70+ for 5 seconds.',
      },
      scoreAtTrigger: (score) => `score ${score} at the time`,
      driverLabel: 'Main driver',
      driver: {
        acoustic: 'Acoustic signal (loudness / pace)',
        semantic: 'AI tone read',
        keyword: 'High-risk phrasing',
        combined: 'Acoustic and semantic together',
      },
      acousticLine: (volume, speed, points) => `Loudness ${volume}%, pace ${speed} → ${points} pts`,
      semanticLine: (tone, intensity, points) =>
        `AI read "${tone}", intensity ${intensity} → ${points} pts`,
      semanticIdleLine: 'AI resting — only the local lexicon spoke on this tick.',
      keywordLine: (keywords, points) => `Matched phrasing: ${keywords} → ${points} pts`,
      keywordNone: 'No high-risk phrasing matched.',
      floorNote: 'Quiet but hostile: the semantic floor lifted the score to 72.',
      shareLabel: 'Share of the evidence',
      quoteLabel: 'The sentence',
      noSignals: 'This reminder fired before the first scored tick, so there is no signal to show.',
      tone: {
        aggressive: 'aggressive',
        'passive-aggressive': 'passive-aggressive',
        defensive: 'defensive',
        neutral: 'neutral',
        positive: 'positive',
      },
    },
  },
})
