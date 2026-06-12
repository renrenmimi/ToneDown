// Thin Groq client. The API key exists only in process.env here; it must
// never be logged, echoed in errors, or sent anywhere except api.groq.com.

const GROQ_BASE = 'https://api.groq.com/openai/v1'

export const CHAT_MODEL = 'llama-3.3-70b-versatile'
export const WHISPER_MODEL = 'whisper-large-v3-turbo'

export class UpstreamError extends Error {
  status: number

  constructor(status: number, code: string) {
    super(code)
    this.name = 'UpstreamError'
    this.status = status
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

export async function fetchGroq(
  path: string,
  init: { method: 'POST'; body: FormData | string; contentType?: string },
  timeoutMs: number,
): Promise<Response> {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    throw new UpstreamError(500, 'MISSING_API_KEY')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${GROQ_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.contentType ? { 'Content-Type': init.contentType } : {}),
      },
      body: init.body,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UpstreamError(504, 'UPSTREAM_TIMEOUT')
    }
    throw new UpstreamError(502, 'UPSTREAM_UNREACHABLE')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // Status only — Groq error bodies can echo request content.
    throw new UpstreamError(502, `UPSTREAM_ERROR_${response.status}`)
  }

  return response
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatJsonOptions<T> {
  messages: ChatMessage[]
  temperature: number
  maxTokens: number
  validate: (raw: string) => T | null
  /** Corrective instruction appended after an invalid reply before the single retry. */
  correctiveMessage: string
  timeoutMs: number
  retryTimeoutMs: number
}

async function chatOnce(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number,
): Promise<string> {
  const response = await fetchGroq(
    '/chat/completions',
    {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    },
    timeoutMs,
  )

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * Chat completion in JSON mode with strict validation: one attempt, then one
 * corrective retry at temperature 0, then UpstreamError(502, BAD_LLM_OUTPUT)
 * so the client falls back to local rules.
 */
export async function chatJSON<T>(options: ChatJsonOptions<T>): Promise<T> {
  const { messages, temperature, maxTokens, validate, correctiveMessage } = options

  const firstRaw = await chatOnce(messages, temperature, maxTokens, options.timeoutMs)
  const first = validate(firstRaw)
  if (first !== null) {
    return first
  }

  const retryMessages: ChatMessage[] = [
    ...messages,
    { role: 'assistant', content: firstRaw },
    { role: 'user', content: correctiveMessage },
  ]
  const retryRaw = await chatOnce(retryMessages, 0, maxTokens, options.retryTimeoutMs)
  const retried = validate(retryRaw)
  if (retried !== null) {
    return retried
  }

  throw new UpstreamError(502, 'BAD_LLM_OUTPUT')
}
