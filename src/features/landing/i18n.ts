import { createI18n } from '@/shared/i18n/createI18n'

interface LandingStrings {
  heroTitle: string
  heroSub: string
  ctaLive: string
  ctaDemo: string
  gaugeCaption: string
  how: {
    title: string
    cards: { title: string; body: string }[]
  }
  engineers: {
    title: string
    intro: string
    boxes: { client: string; proxy: string; groq: string }
    clientDetail: string
    proxyDetail: string
    groqDetail: string
    fallbackTitle: string
    fallbackChips: string[]
    footnote: string
  }
  privacy: string
  notCounseling: string
  themeToggle: string
}

export const { useT: useLandingT } = createI18n<LandingStrings>({
  'zh-CN': {
    heroTitle: '听见自己在对方耳中的声音。',
    heroSub:
      'ToneDown 与你一起倾听：每 2 秒为语气打分，在火药味出现时递上更温和的说法。全程不录音。',
    ctaLive: '立即体验',
    ctaDemo: '看演示（30 秒）',
    gaugeCaption: '真实仪表盘 · 录制片段回放',
    how: {
      title: '它如何陪你说话',
      cards: [
        { title: '它倾听', body: '麦克风信号在浏览器里实时变成音量与语速两条曲线。' },
        { title: '它打分', body: '声学信号与 AI 语义判断每 2 秒融合成一个语气分数。' },
        { title: '它接住你', body: '说急了的话会被标记，并马上递上一句更温和的说法。' },
      ],
    },
    engineers: {
      title: '为工程师准备的一页',
      intro: '优雅降级是这个产品的设计核心——失败路径和成功路径同样用心。',
      boxes: { client: '浏览器', proxy: 'Vercel 代理', groq: 'Groq' },
      clientDetail: 'RMS 音量 + 语速 + 规则引擎，状态机驱动',
      proxyDetail: '密钥托管 · 限流 · LLM 输出严格校验',
      groqDetail: 'whisper-large-v3-turbo · llama-3.3-70b',
      fallbackTitle: '降级链',
      fallbackChips: ['Groq Whisper → 浏览器识别 → 仅音量', 'LLM 语义 → 关键词规则', '断路器 30s→5min 退避'],
      footnote: '完全离线时，整个评分循环仍以规则模式运行。',
    },
    privacy: '音频仅在传输中被分析，随即丢弃。历史只存在你的浏览器里，服务器不存一个字。',
    notCounseling: '本工具仅为沟通辅助，不提供心理咨询服务',
    themeToggle: '切换深浅色主题',
  },
  'en-US': {
    heroTitle: 'Hear yourself the way they do.',
    heroSub:
      'ToneDown listens with you — scoring your tone every two seconds and handing you calmer words when things heat up. Nothing is ever recorded.',
    ctaLive: 'Try it live',
    ctaDemo: 'Watch the demo (30s)',
    gaugeCaption: 'The real gauge · replaying a recorded moment',
    how: {
      title: 'How it keeps you company',
      cards: [
        { title: 'It listens', body: 'Mic signal becomes loudness and pace curves, right in your browser.' },
        { title: 'It scores', body: 'Acoustic signals fuse with AI semantic judgment into one tone score every 2s.' },
        { title: 'It catches you', body: 'Hot phrases get flagged — with a calmer way to say it, offered instantly.' },
      ],
    },
    engineers: {
      title: 'For the visiting engineers',
      intro: 'Built to degrade gracefully — the failure paths got as much care as the happy path.',
      boxes: { client: 'Browser', proxy: 'Vercel proxy', groq: 'Groq' },
      clientDetail: 'RMS volume + speech rate + rules engine, state-machine driven',
      proxyDetail: 'key custody · rate limits · strict LLM output validation',
      groqDetail: 'whisper-large-v3-turbo · llama-3.3-70b',
      fallbackTitle: 'The fallback chain',
      fallbackChips: [
        'Groq Whisper → Web Speech → volume-only',
        'LLM semantics → keyword rules',
        'circuit breakers, 30s→5min backoff',
      ],
      footnote: 'Fully offline, the whole scoring loop still runs in rules mode.',
    },
    privacy:
      'Audio is analyzed in flight and discarded. History lives in your browser. The server never stores a word.',
    notCounseling: 'This tool is for communication support only and is not counseling.',
    themeToggle: 'Toggle light/dark theme',
  },
})
