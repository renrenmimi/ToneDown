import { createI18n } from '@/shared/i18n/createI18n'

interface HistoryStrings {
  title: string
  back: string
  empty: string
  heatmapTitle: string
  trendTitle: string
  legendLess: string
  legendMore: string
  sessionsCount: (n: number) => string
  calmScoreShort: string
  exportJson: string
  deleteAll: string
  deleteHint: string
  heatmapCellLabel: (date: string, calm: number, sessions: number) => string
  heatmapAriaLabel: string
  trendAriaLabel: string
  themeToggle: string
}

export const { useT: useHistoryT } = createI18n<HistoryStrings>({
  'en-US': {
    title: 'Your history',
    back: 'Live session',
    empty: 'No sessions yet — your first one starts on the live page.',
    heatmapTitle: 'Calm calendar',
    trendTitle: 'Calm score over time',
    legendLess: 'less calm',
    legendMore: 'more calm',
    sessionsCount: (n) => `${n} session${n === 1 ? '' : 's'}`,
    calmScoreShort: 'calm',
    exportJson: 'Export JSON',
    deleteAll: 'Hold to erase everything',
    deleteHint: 'No cloud, no copies — gone is gone.',
    heatmapCellLabel: (date, calm, sessions) =>
      `${date} — calm score ${calm}, ${sessions} session${sessions === 1 ? '' : 's'}`,
    heatmapAriaLabel: 'Calm score calendar heatmap',
    trendAriaLabel: 'Calm score trend over time',
    themeToggle: 'Toggle light/dark theme',
  },
  'zh-CN': {
    title: '你的历史',
    back: '实时检测',
    empty: '还没有记录——去实时页开始第一次吧。',
    heatmapTitle: '冷静日历',
    trendTitle: '冷静分走势',
    legendLess: '欠冷静',
    legendMore: '更冷静',
    sessionsCount: (n) => `共 ${n} 次`,
    calmScoreShort: '冷静',
    exportJson: '导出 JSON',
    deleteAll: '长按清空全部数据',
    deleteHint: '没有云端备份——删了就真的没了。',
    heatmapCellLabel: (date, calm, sessions) => `${date} — 冷静分 ${calm}，${sessions} 次`,
    heatmapAriaLabel: '冷静分日历热力图',
    trendAriaLabel: '冷静分时间趋势',
    themeToggle: '切换深浅色主题',
  },
})
