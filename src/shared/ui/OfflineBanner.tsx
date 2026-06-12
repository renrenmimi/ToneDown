import { useEffect, useState } from 'react'
import { useLocale } from '@/shared/i18n/localeContext'

const COPY = {
  'en-US': {
    offline: 'Offline — keeping score the old-fashioned way.',
    back: 'Back online — AI rejoined.',
  },
  'zh-CN': {
    offline: '已离线——改用本地规则继续陪你。',
    back: '已恢复在线——AI 归队。',
  },
} as const

export function OfflineBanner() {
  const { locale } = useLocale()
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [justRecovered, setJustRecovered] = useState(false)

  useEffect(() => {
    const goOffline = () => {
      setOffline(true)
      setJustRecovered(false)
    }
    const goOnline = () => {
      setOffline(false)
      setJustRecovered(true)
      window.setTimeout(() => setJustRecovered(false), 4_000)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline && !justRecovered) {
    return null
  }

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-50 px-4 py-1.5 text-center text-xs font-semibold ${
        offline ? 'bg-accent/90 text-on-accent' : 'bg-brand/90 text-surface'
      }`}
    >
      {offline ? COPY[locale].offline : COPY[locale].back}
    </div>
  )
}
