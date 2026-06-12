// Shared mini chart: the session's score series as a single SVG polyline
// over soft band stripes. Reused by RecapView and (scaled) the PNG layout
// reference; the canvas renderer draws its own copy.

const W = 320
const H = 96
const PAD = 6

interface ArcSparklineProps {
  series: [number, number][]
  durationMs: number
}

export function ArcSparkline({ series, durationMs }: ArcSparklineProps) {
  if (series.length < 2 || durationMs <= 0) {
    return null
  }

  const x = (ms: number) => PAD + (ms / durationMs) * (W - PAD * 2)
  const y = (score: number) => PAD + (1 - score / 100) * (H - PAD * 2)
  const points = series.map(([ms, score]) => `${x(ms).toFixed(1)},${y(score).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" role="img" aria-hidden>
      {/* band stripes: calm / tense / heated / hostile */}
      <rect x={0} y={y(100)} width={W} height={y(75) - y(100)} fill="var(--tone-hostile)" fillOpacity={0.08} />
      <rect x={0} y={y(75)} width={W} height={y(55) - y(75)} fill="var(--tone-heated)" fillOpacity={0.07} />
      <rect x={0} y={y(55)} width={W} height={y(30) - y(55)} fill="var(--tone-tense)" fillOpacity={0.06} />
      <rect x={0} y={y(30)} width={W} height={y(0) - y(30)} fill="var(--tone-calm)" fillOpacity={0.08} />
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
