import { createI18n } from '@/shared/i18n/createI18n'

export type AchievementId =
  | 'day-one'
  | 'steady-week'
  | 'switch-hitter'
  | 'word-surgeon'
  | 'phoenix'

interface GymStrings {
  title: string
  subtitle: string
  back: string
  todayLabel: string
  inputPlaceholder: string
  submit: string
  grading: string
  showHint: string
  hintLabel: string
  passLine: (score: number) => string
  failLine: (score: number) => string
  betterLabel: string
  streakLabel: (days: number) => string
  clearedToday: string
  apiDown: string
  achievementsTitle: string
  achievements: Record<AchievementId, { name: string; desc: string }>
  themeToggle: string
  holdToTalk: string
}

export const { useT: useGymT } = createI18n<GymStrings>({
  'en-US': {
    title: 'Tone Gym',
    subtitle: 'One prickly phrase a day. Say it better — 90+ clears it.',
    back: 'Live session',
    todayLabel: "Today's phrase",
    inputPlaceholder: 'Your calmer version…',
    submit: 'Grade it',
    grading: 'The judge is listening…',
    showHint: 'Show a hint (free — this is a gym, not an exam)',
    hintLabel: 'Hint',
    passLine: (score) => `${score} — smooth. Tomorrow's phrase will be pricklier.`,
    failLine: (score) => `${score} — close. Lead with what you need, not what they did.`,
    betterLabel: 'Even stronger',
    streakLabel: (days) => (days === 1 ? '1 calm day' : `${days} calm days in a row`),
    clearedToday: 'Cleared today ✓',
    apiDown: 'The judge is resting — rules mode can\'t grade nuance. Try again later.',
    achievementsTitle: 'Achievements',
    achievements: {
      'day-one': { name: 'Day One', desc: 'First drill cleared' },
      'steady-week': { name: 'Steady Week', desc: '7-day streak' },
      'switch-hitter': { name: 'Switch Hitter', desc: 'Cleared in both languages' },
      'word-surgeon': { name: 'Word Surgeon', desc: 'Scored 95+' },
      phoenix: { name: 'Phoenix', desc: 'Cleared after two failed tries' },
    },
    themeToggle: 'Toggle light/dark theme',
    holdToTalk: 'Hold to talk',
  },
  'zh-CN': {
    title: '语气健身房',
    subtitle: '每天一句扎手的话。换个说法——90 分以上过关。',
    back: '实时检测',
    todayLabel: '今日句子',
    inputPlaceholder: '你的更温和版本……',
    submit: '打分',
    grading: '裁判正在听……',
    showHint: '看提示（免费——这是健身房，不是考场）',
    hintLabel: '提示',
    passLine: (score) => `${score} 分，漂亮。明天的句子会更扎手。`,
    failLine: (score) => `${score} 分，差一点。先说你的需要，而不是对方的错。`,
    betterLabel: '还能更稳',
    streakLabel: (days) => `连续冷静 ${days} 天`,
    clearedToday: '今日已过关 ✓',
    apiDown: '裁判在休息——规则模式打不了这种分，稍后再来。',
    achievementsTitle: '成就',
    achievements: {
      'day-one': { name: '第一天', desc: '首次过关' },
      'steady-week': { name: '稳稳一周', desc: '连续 7 天' },
      'switch-hitter': { name: '双语选手', desc: '中英文都过关' },
      'word-surgeon': { name: '言辞外科医生', desc: '拿到 95 分以上' },
      phoenix: { name: '浴火重生', desc: '失败两次后过关' },
    },
    themeToggle: '切换深浅色主题',
    holdToTalk: '按住说话',
  },
})
