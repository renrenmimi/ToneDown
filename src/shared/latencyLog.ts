// Dev-only latency instrumentation for the speech -> score pipeline.
// Samples are kept on window.__toneDownLatency so both DevTools and automated
// runs can read them; production builds compile this away to a no-op.

export type LatencyStage =
  | 'transcribe'
  | 'analyze'
  | 'rewrite'
  | 'debrief'
  | 'sparring'
  | 'gym'

interface LatencyWindow extends Window {
  __toneDownLatency?: Record<LatencyStage, number[]>
}

const samples: Record<LatencyStage, number[]> = {
  transcribe: [],
  analyze: [],
  rewrite: [],
  debrief: [],
  sparring: [],
  gym: [],
}

export function recordLatency(stage: LatencyStage, ms: number): void {
  if (!import.meta.env.DEV) {
    return
  }
  samples[stage].push(Math.round(ms))
  ;(window as LatencyWindow).__toneDownLatency = samples
  console.debug(`[latency] ${stage}: ${Math.round(ms)}ms`)
}
