import { createI18n } from '@/shared/i18n/createI18n'
import type { SparringPersonaId } from '@/types/api'

interface PersonaCopy {
  name: string
  bio: string
  opener: string
}

interface SparringStrings {
  title: string
  subtitle: string
  back: string
  tiers: Record<1 | 2 | 3, string>
  personas: Record<SparringPersonaId, PersonaCopy>
  inputPlaceholder: string
  send: string
  endRound: string
  turnsLeft: (n: number) => string
  coachLabel: string
  youLabel: string
  winLine: (persona: string) => string
  lossStormed: string
  lossCap: string
  rematch: string
  pickAnother: string
  apiDown: string
  scorecard: {
    title: string
    exitMood: string
    calmStreak: string
    slips: string
    noSlips: string
    worstSlip: string
    whatWorked: string
    noCalmTurn: string
  }
  muteOn: string
  muteOff: string
  holdToTalk: string
  themeToggle: string
}

export const { useT: useSparringT } = createI18n<SparringStrings>({
  'en-US': {
    title: 'Sparring',
    subtitle: 'Practice staying calm against a difficult counterpart. Win by de-escalating.',
    back: 'Live session',
    tiers: { 1: 'Warm-up', 2: 'Workplace', 3: 'Boss fight' },
    personas: {
      'slow-barista': {
        name: 'Slow Barista',
        bio: 'Will make your latte. Eventually. Probably oat milk either way.',
        opener: "Oh hey — sorry, was that a... medium? We're out of medium cups. Also possibly milk.",
      },
      'pushy-salesperson': {
        name: 'Pushy Salesperson',
        bio: 'Has a deal that expires the moment you blink.',
        opener: 'Great news — today ONLY, this plan is 40% off. I just need a yes right now.',
      },
      'passive-aggressive-coworker': {
        name: 'Passive-Aggressive Coworker',
        bio: "Fine. It's fine. Everything's fine.",
        opener: "Oh no, don't worry about the deadline. I'll just stay late again. It's fine.",
      },
      'unreasonable-landlord': {
        name: 'Unreasonable Landlord',
        bio: 'The mold was there when you moved in. Spiritually.',
        opener: "You called about the mold? That's a lifestyle issue, not a building issue.",
      },
      'critical-relative': {
        name: '挑剔的亲戚 · Critical Relative',
        bio: '「工资多少？买房了吗？隔壁小王都二胎了。」(speaks Chinese)',
        opener: '哎呀，好久不见！工资多少了？买房了吗？隔壁小王孩子都两个了。',
      },
      'furious-customer': {
        name: 'Furious Customer',
        bio: "Wants a refund, an apology, and your manager's manager.",
        opener: 'TWICE. This arrived broken TWICE. Refund. Manager. Now.',
      },
    },
    inputPlaceholder: 'Say it calmer than they do…',
    send: 'Send',
    endRound: 'End round',
    turnsLeft: (n) => `${n} turns left`,
    coachLabel: 'Coach',
    youLabel: 'You',
    winLine: (persona) => `De-escalated like a pro. ${persona} left smiling.`,
    lossStormed: 'They stormed off — happens to the best of us.',
    lossCap: 'They had to run — time for the scorecard.',
    rematch: 'Rematch',
    pickAnother: 'Pick another',
    apiDown: 'The AI is resting — sparring needs it. Try again in a bit.',
    scorecard: {
      title: 'Scorecard',
      exitMood: 'Exit mood',
      calmStreak: 'Best calm streak',
      slips: 'Hostility slips',
      noSlips: 'Zero slips. Frosty.',
      worstSlip: 'Spiciest moment',
      whatWorked: 'What worked',
      noCalmTurn: 'Next time, try acknowledging before answering.',
    },
    muteOn: 'Unmute persona voice',
    muteOff: 'Mute persona voice',
    holdToTalk: 'Hold to talk',
    themeToggle: 'Toggle light/dark theme',
  },
  'zh-CN': {
    title: '对练场',
    subtitle: '和一个难缠的对手练习保持冷静——把对方"降温"就算赢。',
    back: '实时检测',
    tiers: { 1: '热身', 2: '职场', 3: '高难' },
    personas: {
      'slow-barista': {
        name: '慢吞吞咖啡师',
        bio: '会做你的拿铁的。最终会的。反正大概率是燕麦奶。',
        opener: 'Oh hey — sorry, was that a... medium? We are out of medium cups. Also possibly milk.',
      },
      'pushy-salesperson': {
        name: '强推销售',
        bio: '手里的优惠在你眨眼瞬间就会过期。',
        opener: 'Great news — today ONLY, this plan is 40% off. I just need a yes right now.',
      },
      'passive-aggressive-coworker': {
        name: '阴阳怪气同事',
        bio: '没事。挺好的。一切都好。',
        opener: "Oh no, don't worry about the deadline. I'll just stay late again. It's fine.",
      },
      'unreasonable-landlord': {
        name: '不讲理房东',
        bio: '霉斑是你搬进来之前就有的。从玄学意义上讲。',
        opener: "You called about the mold? That's a lifestyle issue, not a building issue.",
      },
      'critical-relative': {
        name: '挑剔的亲戚',
        bio: '「工资多少？买房了吗？隔壁小王都二胎了。」',
        opener: '哎呀，好久不见！工资多少了？买房了吗？隔壁小王孩子都两个了。',
      },
      'furious-customer': {
        name: '暴怒顾客',
        bio: '要退款、要道歉、还要见你经理的经理。',
        opener: 'TWICE. This arrived broken TWICE. Refund. Manager. Now.',
      },
    },
    inputPlaceholder: '比对方更冷静地说……',
    send: '发送',
    endRound: '结束本局',
    turnsLeft: (n) => `还剩 ${n} 轮`,
    coachLabel: '教练',
    youLabel: '你',
    winLine: (persona) => `教科书级的降温，${persona}是笑着走的。`,
    lossStormed: '对方气走了——谁都有失手的时候。',
    lossCap: '对方先撤了——来看看战报吧。',
    rematch: '再来一局',
    pickAnother: '换个对手',
    apiDown: 'AI 在休息——对练需要它，稍后再试吧。',
    scorecard: {
      title: '战报',
      exitMood: '离场心情',
      calmStreak: '最长冷静连击',
      slips: '失守次数',
      noSlips: '零失守，稳如冰。',
      worstSlip: '最上头的一句',
      whatWorked: '有效的招',
      noCalmTurn: '下次试试先共情、再回应。',
    },
    muteOn: '开启角色语音',
    muteOff: '静音角色语音',
    holdToTalk: '按住说话',
    themeToggle: '切换深浅色主题',
  },
})
