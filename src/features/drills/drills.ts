// Curated bilingual drill bank. The daily drill is deterministic:
// daysSinceEpoch % 5, per locale — switching locale switches the drill,
// which is exactly how Switch Hitter gets earned.

export interface Drill {
  id: string
  locale: 'zh-CN' | 'en-US'
  phrase: string
  hint: string
}

export const DRILLS: Drill[] = [
  {
    id: 'zh-1',
    locale: 'zh-CN',
    phrase: '你怎么又迟到了？说了多少次了！',
    hint: '描述影响 + 提出具体约定：「等久了我有点着急——下次提前发个消息好吗？」',
  },
  {
    id: 'zh-2',
    locale: 'zh-CN',
    phrase: '这点小事都做不好，要你有什么用？',
    hint: '对事不对人：指出具体问题，再表达期待。',
  },
  {
    id: 'zh-3',
    locale: 'zh-CN',
    phrase: '行行行，都是我的错，行了吧？',
    hint: '承认情绪在场，再回到具体分歧：「我有点烦了，我们先理清楚到底卡在哪。」',
  },
  {
    id: 'zh-4',
    locale: 'zh-CN',
    phrase: '别管我，烦死了。',
    hint: '要空间也给时间：「我现在需要静一静，半小时后我们再聊。」',
  },
  {
    id: 'zh-5',
    locale: 'zh-CN',
    phrase: '你从来都不在乎这个家。',
    hint: '用具体事例 + 「我」开头：「这周家里的事都是我在弄，我觉得很累。」',
  },
  {
    id: 'en-1',
    locale: 'en-US',
    phrase: 'You never listen to me.',
    hint: 'Feeling + specific ask: "I don\'t feel heard right now — can I finish this thought?"',
  },
  {
    id: 'en-2',
    locale: 'en-US',
    phrase: 'This is the dumbest plan I have ever seen.',
    hint: 'Critique the plan, not the planner; name one concern and one alternative.',
  },
  {
    id: 'en-3',
    locale: 'en-US',
    phrase: 'Whatever. Do what you want.',
    hint: 'State the need instead of withdrawing: "I do care about this — I need a minute to say it right."',
  },
  {
    id: 'en-4',
    locale: 'en-US',
    phrase: 'Why is this SO hard for you?',
    hint: 'Ask about the obstacle, offer help: "What\'s blocking this? Want a hand?"',
  },
  {
    id: 'en-5',
    locale: 'en-US',
    phrase: 'I am done talking about this.',
    hint: 'Pause with a return time: "I need a break — can we pick this up at eight?"',
  },
]

export function todaysDrill(locale: 'zh-CN' | 'en-US', now = Date.now()): Drill {
  const pool = DRILLS.filter((d) => d.locale === locale)
  return pool[localDayIndex(now) % pool.length]
}

/**
 * Days since epoch counted on the LOCAL calendar, so the drill rotates at the
 * same midnight that localDateKey (and therefore clearedToday and the streak)
 * rolls over on. now/86_400_000 counts UTC days: in UTC-7 that swapped the
 * drill at 5pm local, mid-afternoon resetting a user's cleared badge and
 * offering them a second drill for the same calendar day.
 */
function localDayIndex(now: number): number {
  const d = new Date(now)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

/** djb2 over drillId + normalized attempt — the grade-cache key. */
export function gradeCacheKey(drillId: string, attempt: string): string {
  const normalized = `${drillId}:${attempt.trim().toLowerCase().replace(/\s+/g, ' ')}`
  let hash = 5381
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0
  }
  return `${drillId}:${hash.toString(36)}`
}

export function localDateKey(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
