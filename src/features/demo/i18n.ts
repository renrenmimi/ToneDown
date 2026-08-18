import { createI18n } from '@/shared/i18n/createI18n'

interface DemoStrings {
  chip: string
  restart: string
  tryLive: string
  back: string
  endedNote: string
  themeToggle: string
  grounding: string
}

export const { useT: useDemoT } = createI18n<DemoStrings>({
  'en-US': {
    chip: 'Scripted replay · no mic, no network, no tokens',
    restart: 'Replay',
    tryLive: 'Try it live',
    back: 'Home',
    endedNote: 'That was the whole loop — live scoring, a flagged moment, one breath, and the recap.',
    themeToggle: 'Toggle light/dark theme',
    grounding: "You're one breath away from a better sentence.",
  },
  'zh-CN': {
    chip: '脚本回放 · 不用麦克风 · 零网络 · 零成本',
    restart: '重播',
    tryLive: '立即体验',
    back: '首页',
    endedNote: '这就是完整闭环——实时打分、标记瞬间、一次呼吸、然后复盘。',
    themeToggle: '切换深浅色主题',
    grounding: '再呼吸一次，就能换一种更好的说法。',
  },
})
