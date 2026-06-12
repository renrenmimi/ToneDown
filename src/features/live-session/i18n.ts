import { createI18n } from '@/shared/i18n/createI18n'
import type { EmotionLevel, SpeedLevel } from '@/types/app'

interface LiveSessionStrings {
  subtitle: string
  themeToggle: string
  historyLink: string
  sparringLink: string
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
  breath: {
    title: string
    inhale: string
    hold: string
    exhale: string
    steady: string
    fallback: string
  }
}

export const { useT: useLiveSessionT, t: liveSessionT } = createI18n<LiveSessionStrings>({
  'zh-CN': {
    subtitle: '情侣语气检测助手',
    themeToggle: '切换深浅色主题',
    historyLink: '查看历史',
    sparringLink: '对练场',
    intro: '实时检测你的语气强度，帮助你把对话拉回冷静区。',
    start: '开始检测',
    stop: '停止',
    listeningTime: '录音时长',
    dashboard: '实时情绪仪表盘',
    transcript: '实时语音转文字',
    engineGroq: 'Groq 语音识别',
    engineBrowser: '浏览器识别',
    sttUnavailable: '语音转写暂时不可用，仅基于音量评分。',
    rulesMode: 'LLM 离线 · 规则模式',
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
    breath: {
      title: '我们一起深呼吸一次',
      inhale: '吸气',
      hold: '屏住',
      exhale: '缓缓呼出',
      steady: '我稳住了',
      fallback: '一次呼吸之后，话会说得更好。',
    },
  },
  'en-US': {
    subtitle: 'Couple Tone Tracking Assistant',
    themeToggle: 'Toggle light/dark theme',
    historyLink: 'View history',
    sparringLink: 'Sparring mode',
    intro: 'Track your tone in real time and bring conversations back to calm.',
    start: 'Start Detection',
    stop: 'Stop',
    listeningTime: 'Recording time',
    dashboard: 'Live Emotion Dashboard',
    transcript: 'Live Speech Transcript',
    engineGroq: 'Groq Whisper',
    engineBrowser: 'Browser STT',
    sttUnavailable: 'Speech transcription is temporarily unavailable; scoring on volume only.',
    rulesMode: 'LLM offline · rules mode',
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
    breath: {
      title: "Let's take one together",
      inhale: 'Breathe in',
      hold: 'Hold',
      exhale: 'Let it go',
      steady: "I'm steady",
      fallback: "You're one breath away from a better sentence.",
    },
  },
})
