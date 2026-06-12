import { Component, type ReactNode } from 'react'

// Route-level error boundary. Class component (React requirement), so locale
// comes from storage directly rather than hooks; the message renders in the
// stored language with the other as fallback context.

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

function storedLocale(): 'zh-CN' | 'en-US' {
  try {
    return localStorage.getItem('tonedown.locale.v1') === 'zh-CN' ? 'zh-CN' : 'en-US'
  } catch {
    return 'en-US'
  }
}

const COPY = {
  'en-US': {
    title: 'Something on our side cracked.',
    body: 'Your audio never left this device. A reload usually fixes it.',
    reload: 'Reload',
  },
  'zh-CN': {
    title: '我们这边出了点小问题。',
    body: '你的声音从未离开这台设备。刷新一下通常就好。',
    reload: '刷新',
  },
} as const

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    // Console only — never report content anywhere.
    console.error('[boundary]', error)
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }
    const copy = COPY[storedLocale()]
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-ink">
        <div className="w-full max-w-sm rounded-sheet border border-line bg-raised p-6 text-center shadow-e3">
          <p className="font-display text-xl font-bold">{copy.title}</p>
          <p className="mt-2 text-sm text-ink-secondary">{copy.body}</p>
          <button
            type="button"
            className="mt-5 rounded-full bg-accent-fill px-8 py-3 text-sm font-semibold text-on-accent shadow-e2 transition hover:brightness-110"
            onClick={() => window.location.reload()}
          >
            {copy.reload}
          </button>
        </div>
      </div>
    )
  }
}
