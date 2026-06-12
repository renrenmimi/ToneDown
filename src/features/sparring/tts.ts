// Persona voice via the browser's speechSynthesis — zero cost, zero network.
// Feature-detected; a missing voice (common for zh on some platforms) simply
// means text-only. Mute preference persists.

const MUTE_KEY = 'tonedown.spar.muted.v1'

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function persistMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // fine
  }
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  const exact = voices.find((v) => v.lang.replace('_', '-') === lang)
  if (exact) {
    return exact
  }
  const prefix = lang.slice(0, 2)
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null
}

export interface VoiceSettings {
  lang: 'en-US' | 'zh-CN'
  rate: number
  pitch: number
}

export function speak(text: string, voice: VoiceSettings, muted: boolean): void {
  if (muted || !isTtsSupported()) {
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  const match = pickVoice(voice.lang)
  if (match) {
    utterance.voice = match
  }
  utterance.lang = voice.lang
  utterance.rate = voice.rate
  utterance.pitch = voice.pitch
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export function cancelSpeech(): void {
  if (isTtsSupported()) {
    window.speechSynthesis.cancel()
  }
}
