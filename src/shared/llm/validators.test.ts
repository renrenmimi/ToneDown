import { describe, expect, it } from 'vitest'
import {
  parseAnalyzeResponse,
  parseRewriteResponse,
  parseTranscribeResponse,
} from './validators'

describe('parseTranscribeResponse', () => {
  it('accepts a valid payload', () => {
    expect(parseTranscribeResponse({ transcript: '你好', language: 'zh' })).toEqual({
      transcript: '你好',
      language: 'zh',
    })
  })

  it.each([null, [], { transcript: 5, language: 'zh' }, { transcript: 'x' }])(
    'rejects %j',
    (bad) => {
      expect(parseTranscribeResponse(bad)).toBeNull()
    },
  )
})

describe('parseAnalyzeResponse', () => {
  it('accepts and clamps a valid payload', () => {
    expect(
      parseAnalyzeResponse({ tone: 'aggressive', intensity: 130.7, rationale: 'r' }),
    ).toEqual({ tone: 'aggressive', intensity: 100, rationale: 'r' })
  })

  it.each([
    { tone: 'angry', intensity: 50, rationale: '' },
    { tone: 'aggressive', intensity: Number.NaN, rationale: '' },
    { tone: 'aggressive', intensity: '80', rationale: '' },
    { tone: 'aggressive', intensity: 80 },
  ])('rejects %j', (bad) => {
    expect(parseAnalyzeResponse(bad)).toBeNull()
  })
})

describe('parseRewriteResponse', () => {
  it('accepts and trims a valid payload', () => {
    expect(parseRewriteResponse({ rewrite: '  better words  ' })).toEqual({
      rewrite: 'better words',
    })
  })

  it.each([{ rewrite: '' }, { rewrite: '   ' }, { rewrite: 7 }, 'rewrite'])(
    'rejects %j',
    (bad) => {
      expect(parseRewriteResponse(bad)).toBeNull()
    },
  )
})
