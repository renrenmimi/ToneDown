import { createI18n } from '@/shared/i18n/createI18n'

interface RecapStrings {
  headlineCalm: string
  headlineStormy: string
  calmScoreLabel: string
  duration: string
  peak: string
  breaths: string
  flagged: string
  arcTitle: string
  debriefLoading: string
  debriefFailed: string
  triggersTitle: string
  whyLabel: string
  betterLabel: string
  habitTitle: string
  downloadCard: string
  newSession: string
  savedLocally: string
}

export const { useT: useRecapT, t: recapT } = createI18n<RecapStrings>({
  'en-US': {
    headlineCalm: 'You stayed mostly in the calm zone. Nice exhale.',
    headlineStormy: 'Stormy in the middle — but you brought it home.',
    calmScoreLabel: 'Calm score',
    duration: 'Duration',
    peak: 'Peak heat',
    breaths: 'Breathing breaks',
    flagged: 'Flagged moments',
    arcTitle: 'How it sounded',
    debriefLoading: 'Your coach is writing the debrief…',
    debriefFailed: 'The AI debrief is resting — your timeline still tells the story.',
    triggersTitle: 'Moments worth a second look',
    whyLabel: 'Why it escalated',
    betterLabel: 'Try instead',
    habitTitle: 'One habit to practice',
    downloadCard: 'Download card',
    newSession: 'New session',
    savedLocally: 'Saved in this browser only',
  },
  'zh-CN': {
    headlineCalm: '你大部分时间都待在冷静区，干得漂亮。',
    headlineStormy: '中段有点风浪，但你把对话带回了平静。',
    calmScoreLabel: '冷静分',
    duration: '时长',
    peak: '峰值热度',
    breaths: '呼吸暂停',
    flagged: '标记瞬间',
    arcTitle: '这段对话听起来',
    debriefLoading: '教练正在写复盘……',
    debriefFailed: 'AI 复盘在休息——时间线本身已经说明了一切。',
    triggersTitle: '值得回看的瞬间',
    whyLabel: '为什么会升级',
    betterLabel: '可以这样说',
    habitTitle: '下次练习一个小习惯',
    downloadCard: '下载卡片',
    newSession: '再来一次',
    savedLocally: '仅保存在此浏览器中',
  },
})
