import type { TranscribeResponse } from '../types/api'
import type { AppLanguage } from '../types/app'

// All calls use relative /api/... URLs so the same build works against the
// Vite dev proxy, `vercel dev`, and production.

const TRANSCRIBE_TIMEOUT_MS = 12_000

export class ApiCallError extends Error {
  /** HTTP status, or 0 for network errors / timeouts / bad response shapes. */
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiCallError'
    this.status = status
  }
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, method: 'POST', signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiCallError(0, 'TIMEOUT')
    }
    throw new ApiCallError(0, 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
  }
}

export function toLanguageHint(language: AppLanguage): 'zh' | 'en' {
  return language === 'zh-CN' ? 'zh' : 'en'
}

export async function transcribe(
  audio: Blob,
  mime: string,
  langHint: 'zh' | 'en',
): Promise<TranscribeResponse> {
  const response = await postWithTimeout(
    `/api/transcribe?lang=${langHint}`,
    {
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-audio-mime': mime,
      },
      body: audio,
    },
    TRANSCRIBE_TIMEOUT_MS,
  )

  if (!response.ok) {
    throw new ApiCallError(response.status, `HTTP_${response.status}`)
  }

  const data: unknown = await response.json().catch(() => null)
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as TranscribeResponse).transcript !== 'string' ||
    typeof (data as TranscribeResponse).language !== 'string'
  ) {
    throw new ApiCallError(0, 'BAD_RESPONSE_SHAPE')
  }

  return data as TranscribeResponse
}
