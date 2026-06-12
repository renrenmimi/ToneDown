// Pure filters guarding the Groq STT path: silence gating (don't upload
// quiet segments) and Whisper hallucination removal.

// Silence gate: segments quieter than this are dropped without uploading.
// Saves Groq quota and is the primary defense against Whisper hallucinating
// text on silence (observed live: near-silent audio with a zh hint reliably
// produced "请不吝点赞 订阅 转发 …").
export const SILENCE_MEAN_THRESHOLD = 5
export const SILENCE_PEAK_THRESHOLD = 12

// Known Whisper silence hallucinations, matched against the whole trimmed result.
export const HALLUCINATION_PATTERNS: RegExp[] = [
  /^(thank you|thanks|thank you for watching|thanks for watching|please subscribe|bye)[.!\s]*$/i,
  /字幕由.*提供/,
  /请不吝点赞/,
  /谢谢(大家)?(观看|收看)/,
  /明镜与点点/,
  /amara\.org/i,
]

export const QUIET_PEAK_THRESHOLD = 15
export const QUIET_MIN_TEXT_LENGTH = 5

export function isSilentSegment(meanVolume: number, peakVolume: number): boolean {
  return meanVolume < SILENCE_MEAN_THRESHOLD && peakVolume < SILENCE_PEAK_THRESHOLD
}

export function filterTranscript(raw: string, peakVolume: number): string | null {
  const text = raw.trim()
  if (text.length === 0) {
    return null
  }
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return null
  }
  // A near-silent segment that still produced a tiny result is almost
  // certainly noise rather than speech.
  if (peakVolume < QUIET_PEAK_THRESHOLD && text.length < QUIET_MIN_TEXT_LENGTH) {
    return null
  }
  return text
}

export function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null
  }
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? null
}
