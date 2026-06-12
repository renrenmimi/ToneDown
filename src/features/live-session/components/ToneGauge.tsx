import { useEffect, useRef, useState } from 'react'

import type { EmotionLevel } from '@/types/app'
import { useLiveSessionT } from '../i18n'
import { toneVar } from '../lib/toneVar'
import { volumeSignal } from '../machine/sessionStore'

// The signature element: three concentric 270° signal rings (amplitude /
// speech rate / LLM semantic intensity) composing into one fused needle
// and score numeral. Geometry: arcs start at 135° (lower-left), sweep
// clockwise 270° to 45°; pathLength=100 so dashoffset = 100 - value with
// no per-radius math.

const CX = 140
const CY = 140
const ARC_START_DEG = 135
const ARC_SWEEP_DEG = 270

interface RingSpec {
  id: 'volume' | 'rate' | 'semantic'
  radius: number
  width: number
}

const RINGS: RingSpec[] = [
  { id: 'volume', radius: 122, width: 12 },
  { id: 'rate', radius: 104, width: 10 },
  { id: 'semantic', radius: 88, width: 8 },
]

function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)]
}

function arcPath(radius: number): string {
  const [x0, y0] = polar(radius, ARC_START_DEG)
  const [x1, y1] = polar(radius, ARC_START_DEG + ARC_SWEEP_DEG)
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v))

interface ToneGaugeProps {
  score: number
  level: EmotionLevel
  /** Speech rate normalized 0-100. */
  rateValue: number
  /** LLM semantic intensity 0-100 (0 when stale/unavailable). */
  semanticValue: number
  trendIcon: string
  trendLabel: string
}

export function ToneGauge({
  score,
  level,
  rateValue,
  semanticValue,
  trendIcon,
  trendLabel,
}: ToneGaugeProps) {
  const copy = useLiveSessionT()
  const volumeArcRef = useRef<SVGPathElement | null>(null)
  const [focusedRing, setFocusedRing] = useState<RingSpec['id'] | null>(null)

  // Amplitude ring: 10Hz feel via direct DOM writes off the signal bus —
  // never React state. A 120ms linear CSS transition smooths between writes.
  useEffect(() => {
    return volumeSignal.subscribe((volume) => {
      volumeArcRef.current?.style.setProperty('stroke-dashoffset', String(100 - clamp100(volume)))
    })
  }, [])

  const ringLabel: Record<RingSpec['id'], string> = {
    volume: copy.gauge.volumeRing,
    rate: copy.gauge.rateRing,
    semantic: copy.gauge.semanticRing,
  }
  const ringValue: Record<RingSpec['id'], number> = {
    volume: clamp100(volumeSignal.get()),
    rate: clamp100(rateValue),
    semantic: clamp100(semanticValue),
  }
  const ringColor: Record<RingSpec['id'], string> = {
    volume: '#7c8ce4',
    rate: 'var(--brand)',
    // Only the semantic ring (the actual judgment) takes the tone color.
    semantic: toneVar(level),
  }

  const needleDeg = ARC_START_DEG + (clamp100(score) / 100) * ARC_SWEEP_DEG

  return (
    <div className="relative mx-auto w-fit" style={{ contain: 'paint' }}>
      <svg viewBox="0 0 280 280" className="h-72 w-72" role="presentation">
        {RINGS.map((ring) => (
          <g key={ring.id}>
            {/* track */}
            <path
              d={arcPath(ring.radius)}
              fill="none"
              stroke="var(--border-subtle)"
              strokeOpacity={0.5}
              strokeWidth={ring.width}
              strokeLinecap="round"
            />
            {/* value */}
            <path
              ref={ring.id === 'volume' ? volumeArcRef : undefined}
              d={arcPath(ring.radius)}
              fill="none"
              stroke={ringColor[ring.id]}
              strokeWidth={ring.width}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={ring.id === 'volume' ? 100 : 100 - ringValue[ring.id]}
              style={{
                transition:
                  ring.id === 'volume'
                    ? 'stroke-dashoffset 120ms linear'
                    : ring.id === 'rate'
                      ? 'stroke-dashoffset 800ms var(--ease-out-soft)'
                      : 'stroke-dashoffset 1000ms var(--ease-out-soft), stroke 600ms linear',
              }}
            />
            {/* a11y + hover hit target */}
            <path
              d={arcPath(ring.radius)}
              fill="none"
              stroke="transparent"
              strokeWidth={ring.width + 8}
              role="img"
              tabIndex={0}
              aria-label={`${ringLabel[ring.id]}: ${Math.round(ringValue[ring.id])}/100`}
              onFocus={() => setFocusedRing(ring.id)}
              onBlur={() => setFocusedRing(null)}
              onMouseEnter={() => setFocusedRing(ring.id)}
              onMouseLeave={() => setFocusedRing(null)}
            />
          </g>
        ))}

        {/* fused needle: a tick riding an inner radius, sprung on score */}
        <g
          style={{
            transform: `rotate(${needleDeg}deg)`,
            transformOrigin: '140px 140px',
            transition: 'transform 600ms var(--ease-spring)',
          }}
        >
          <line
            x1={CX + 66}
            y1={CY}
            x2={CX + 78}
            y2={CY}
            stroke={toneVar(level)}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p
          className="font-display text-6xl font-bold tabular-nums leading-none"
          style={{ color: toneVar(level) }}
        >
          {score}
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-secondary">
          {copy.gauge.bandWord[level]}
        </p>
        <p className="mt-1 text-sm text-ink-muted" aria-label={trendLabel}>
          {trendIcon} <span className="text-xs">{trendLabel}</span>
        </p>
      </div>

      {focusedRing && (
        <div
          role="tooltip"
          className="absolute -bottom-2 left-1/2 w-64 -translate-x-1/2 translate-y-full rounded-field border border-line bg-overlay/95 px-3 py-2 text-center text-xs text-ink-secondary shadow-e2"
        >
          {ringLabel[focusedRing]}
        </div>
      )}

      {/* aria-live fires on content CHANGE, so rendering the band text
          directly announces band transitions only — never the 2s number. */}
      <span className="sr-only" aria-live="polite">
        {copy.emotionState[level]}
      </span>
    </div>
  )
}
