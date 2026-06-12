// Bilingual hostility lexicon + static replacement suggestions.
// This is the zero-network degraded-mode brain: when the LLM is unreachable
// these lists carry scoring (fusion.ts) and suggestions (ToneSuggestion).

export const HIGH_RISK_ZH = [
  '你总是',
  '你从来不',
  '你怎么又',
  '烦死了',
  '别说了',
  '你就不能',
  '我受够了',
  '离婚',
  '分手',
  '滚',
]

export const HIGH_RISK_EN = [
  'you always',
  'you never',
  'shut up',
  "i'm done",
  'whatever',
  'leave me alone',
]

export const MEDIUM_RISK_ZH = ['为什么', '我说了多少次', '你听我说', '不是这样的']

export const MEDIUM_RISK_EN = ["you don't understand", 'listen to me', "that's not fair"]

export interface SuggestionItem {
  keyword: string
  replacement: string
}

export const SUGGESTION_MAP: Record<string, SuggestionItem> = {
  你总是: { keyword: '你总是…', replacement: '我注意到有时候会…' },
  你从来不: { keyword: '你从来不…', replacement: '我希望我们能更多地…' },
  你怎么又: { keyword: '你怎么又…', replacement: '这件事对我来说很重要…' },
  烦死了: { keyword: '烦死了', replacement: '我现在有点不舒服，需要一点空间' },
  别说了: { keyword: '别说了', replacement: '我需要一点时间来整理思绪' },
  你就不能: { keyword: '你就不能…', replacement: '如果你能…我会很感激' },
  'you always': {
    keyword: 'you always',
    replacement: "Try saying: I've noticed that sometimes...",
  },
  'you never': {
    keyword: 'you never',
    replacement: 'Try saying: I wish we could more often...',
  },
  'shut up': {
    keyword: 'shut up',
    replacement: 'Try saying: I need a moment to collect my thoughts',
  },
  whatever: {
    keyword: 'whatever',
    replacement: "Try saying: I'm feeling frustrated and need a break",
  },
  "i'm done": {
    keyword: "I'm done",
    replacement: 'Try saying: I am feeling overwhelmed right now',
  },
}
