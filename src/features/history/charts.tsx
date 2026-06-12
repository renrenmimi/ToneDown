import type { SessionRecord } from '@/shared/storage/records'
import { heatColor, type DayBucket } from './chartData'

// Hand-built SVG charts (components only; data helpers live in chartData.ts).

const WEEKS = 26
const CELL = 12
const GAP = 3

interface HeatmapProps {
  buckets: Map<string, DayBucket>
  cellLabel: (date: string, calm: number, sessions: number) => string
}

export function CalendarHeatmap({ buckets, cellLabel }: HeatmapProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // grid ends on today's week (Sunday-start columns)
  const end = new Date(today)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const cells: { x: number; y: number; key: string; bucket: DayBucket | null; future: boolean }[] = []
  for (let w = 0; w < WEEKS; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(end)
      date.setDate(end.getDate() - (WEEKS - 1 - w) * 7 - (6 - d))
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      cells.push({
        x: w * (CELL + GAP),
        y: d * (CELL + GAP),
        key,
        bucket: buckets.get(key) ?? null,
        future: date > today,
      })
    }
  }

  const width = WEEKS * (CELL + GAP) - GAP
  const height = 7 * (CELL + GAP) - GAP

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="calendar heatmap"
    >
      {cells.map((cell) =>
        cell.future ? null : (
          <rect
            key={cell.key}
            x={cell.x}
            y={cell.y}
            width={CELL}
            height={CELL}
            rx={3}
            fill={cell.bucket ? heatColor(cell.bucket.calmScore) : 'var(--surface-sunken)'}
          >
            <title>
              {cell.bucket
                ? cellLabel(cell.key, cell.bucket.calmScore, cell.bucket.sessions)
                : cell.key}
            </title>
          </rect>
        ),
      )}
    </svg>
  )
}

interface TrendChartProps {
  records: SessionRecord[]
}

export function TrendChart({ records }: TrendChartProps) {
  if (records.length < 2) {
    return null
  }
  const W = 320
  const H = 110
  const PAD = 8
  const xs = (i: number) => PAD + (i / (records.length - 1)) * (W - PAD * 2)
  const ys = (calm: number) => PAD + (1 - calm / 100) * (H - PAD * 2)
  const points = records.map((r, i) => `${xs(i).toFixed(1)},${ys(r.calmScore).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label="calm trend">
      {[25, 50, 75].map((line) => (
        <line
          key={line}
          x1={PAD}
          y1={ys(line)}
          x2={W - PAD}
          y2={ys(line)}
          stroke="var(--border-subtle)"
          strokeDasharray="3 5"
          strokeWidth={1}
        />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {records.map((r, i) => (
        <circle key={r.id ?? i} cx={xs(i)} cy={ys(r.calmScore)} r={3} fill="var(--brand)" />
      ))}
    </svg>
  )
}
