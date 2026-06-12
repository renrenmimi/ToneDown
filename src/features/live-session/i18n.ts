import { createI18n } from '@/shared/i18n/createI18n'
import type { EmotionLevel, SpeedLevel } from '@/types/app'

interface LiveSessionStrings {
  subtitle: string
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
  timeline: string
  timelineEmpty: string
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
  disclaimer: string
  suggestion: {
    original: string
    suggestion: string
    aiBadge: string
  }
  calmReminder: {
    title: string
    description: string
    button: string
    countdown: string
  }
}

export const { useT: useLiveSessionT, t: liveSessionT } = createI18n<LiveSessionStrings>({
  'zh-CN': {
    subtitle: '情侣语气检测助手',
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
    toneSuggestionHint: '检测到高危措辞时，下方会自动弹出替代表达卡片。',
    toneSuggestionEmpty: '当前未检测到高危关键词。',
    toneSuggestionDetected: '检测到的关键词',
    timeline: '情绪变化时间线（最近 5 分钟）',
    timelineEmpty: '开始说话后，这里会出现情绪变化曲线。',
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
    emptyTranscript: '还没有识别到文本，开始说话后会实时显示。',
    emotionState: {
      calm: '一切平和',
      elevated: '语气有些激动',
      heated: '情绪正在升温',
      critical: '需要冷静一下',
    },
    disclaimer: '本工具仅为沟通辅助，不提供心理咨询服务',
    suggestion: {
      original: '原话',
      suggestion: '建议',
      aiBadge: 'AI 建议',
    },
    calmReminder: {
      title: '深呼吸 🌊',
      description: '你的语气正在升高，让我们暂停 30 秒',
      button: '我已经冷静了',
      countdown: '剩余',
    },
  },
  'en-US': {
    subtitle: 'Couple Tone Tracking Assistant',
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
      'When high-risk phrases are detected, a replacement card appears automatically.',
    toneSuggestionEmpty: 'No high-risk keyword detected at the moment.',
    toneSuggestionDetected: 'Detected keywords',
    timeline: 'Emotion Timeline (Last 5 Minutes)',
    timelineEmpty: 'The emotion curve will appear once speech is detected.',
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
    emptyTranscript: 'No transcript yet. Start speaking to see live text.',
    emotionState: {
      calm: 'Everything is calm',
      elevated: 'Tone is getting tense',
      heated: 'Emotion is rising',
      critical: 'Time to cool down',
    },
    disclaimer: 'This tool is for communication support only and is not counseling.',
    suggestion: {
      original: 'Original',
      suggestion: 'Suggestion',
      aiBadge: 'AI suggestion',
    },
    calmReminder: {
      title: 'Take a deep breath 🌊',
      description: 'Your tone is rising. Let us pause for 30 seconds.',
      button: "I'm calm now",
      countdown: 'Left',
    },
  },
})
