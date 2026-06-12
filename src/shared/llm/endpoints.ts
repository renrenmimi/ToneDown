import type {
  AnalyzeRequest,
  AnalyzeResponse,
  DebriefRequest,
  DebriefResponse,
  GymGradeRequest,
  GymGradeResponse,
  SparringRequest,
  SparringResponse,
  RewriteRequest,
  RewriteResponse,
  TranscribeResponse,
} from '@/types/api'
import type { AppLanguage } from '@/types/app'
import { createEndpoint } from './client'
import { estimateTextTokens, estimateTextsTokens } from './estimate'
import {
  parseAnalyzeResponse,
  parseDebriefResponse,
  parseGymGradeResponse,
  parseSparringResponse,
  parseRewriteResponse,
  parseTranscribeResponse,
} from './validators'

// Fixed prompt-side token costs (system prompt + scaffolding) and output
// charges at each route's max_completion_tokens — deliberately conservative.
const ANALYZE_FIXED_TOKENS = 140
const ANALYZE_MAX_OUTPUT = 150
const REWRITE_FIXED_TOKENS = 150
const REWRITE_MAX_OUTPUT = 200
const DEBRIEF_FIXED_TOKENS = 280
const DEBRIEF_MAX_OUTPUT = 500
const SPARRING_FIXED_TOKENS = 260
const SPARRING_MAX_OUTPUT = 220
const GYM_FIXED_TOKENS = 160
const GYM_MAX_OUTPUT = 160
const SEGMENT_SECONDS = 4

export function toLanguageHint(language: AppLanguage): 'zh' | 'en' {
  return language === 'zh-CN' ? 'zh' : 'en'
}

export interface TranscribeClientRequest {
  audio: Blob
  mime: string
  langHint: 'zh' | 'en'
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export const transcribeEndpoint = createEndpoint<TranscribeClientRequest, TranscribeResponse>({
  path: '/api/transcribe',
  timeoutMs: 12_000,
  breaker: 'transcribe',
  feature: 'live-transcribe',
  latencyStage: 'transcribe',
  estimateTokens: () => 0,
  audioSeconds: () => SEGMENT_SECONDS,
  encode: (req) => ({
    body: req.audio,
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-audio-mime': req.mime,
    },
    query: `?lang=${req.langHint}`,
  }),
  validate: parseTranscribeResponse,
})

export const analyzeEndpoint = createEndpoint<AnalyzeRequest, AnalyzeResponse>({
  path: '/api/analyze',
  timeoutMs: 10_000,
  breaker: 'analyze',
  feature: 'live-analyze',
  latencyStage: 'analyze',
  estimateTokens: (req) =>
    ANALYZE_FIXED_TOKENS +
    estimateTextTokens(req.text) +
    estimateTextsTokens(req.context ?? []) +
    ANALYZE_MAX_OUTPUT,
  encode: (req) => ({ body: JSON.stringify(req), headers: jsonHeaders }),
  validate: parseAnalyzeResponse,
})

export const rewriteEndpoint = createEndpoint<RewriteRequest, RewriteResponse>({
  path: '/api/rewrite',
  timeoutMs: 12_000,
  breaker: 'rewrite',
  feature: 'live-rewrite',
  latencyStage: 'rewrite',
  estimateTokens: (req) =>
    REWRITE_FIXED_TOKENS +
    estimateTextTokens(req.utterance) +
    estimateTextsTokens(req.context ?? []) +
    REWRITE_MAX_OUTPUT,
  encode: (req) => ({ body: JSON.stringify(req), headers: jsonHeaders }),
  validate: parseRewriteResponse,
})

export const debriefEndpoint = createEndpoint<DebriefRequest, DebriefResponse>({
  path: '/api/debrief',
  timeoutMs: 20_000,
  breaker: 'debrief',
  feature: 'debrief',
  latencyStage: 'debrief',
  estimateTokens: (req) =>
    DEBRIEF_FIXED_TOKENS +
    estimateTextsTokens(req.entries.map((e) => e.text)) +
    req.scoreSeries.length * 4 +
    DEBRIEF_MAX_OUTPUT,
  encode: (req) => ({ body: JSON.stringify(req), headers: jsonHeaders }),
  validate: parseDebriefResponse,
})

export const sparringEndpoint = createEndpoint<SparringRequest, SparringResponse>({
  path: '/api/sparring',
  timeoutMs: 10_000,
  breaker: 'sparring',
  feature: 'sparring',
  latencyStage: 'sparring',
  estimateTokens: (req) =>
    SPARRING_FIXED_TOKENS +
    estimateTextsTokens(req.history.map((t) => t.text)) +
    SPARRING_MAX_OUTPUT,
  encode: (req) => ({ body: JSON.stringify(req), headers: jsonHeaders }),
  validate: parseSparringResponse,
})

export const gymGradeEndpoint = createEndpoint<GymGradeRequest, GymGradeResponse>({
  path: '/api/gym-grade',
  timeoutMs: 10_000,
  breaker: 'gym',
  feature: 'gym',
  latencyStage: 'gym',
  estimateTokens: (req) =>
    GYM_FIXED_TOKENS +
    estimateTextTokens(req.phrase) +
    estimateTextTokens(req.attempt) +
    GYM_MAX_OUTPUT,
  encode: (req) => ({ body: JSON.stringify(req), headers: jsonHeaders }),
  validate: parseGymGradeResponse,
})
