export const ANALYZE_SYSTEM_PROMPT = [
  'You are a tone classifier for live couple conversations.',
  'Classify the tone of the LATEST utterance only; earlier lines are background context.',
  'Text may be Chinese, English, or mixed.',
  'Respond with ONLY a JSON object, no other text:',
  '{"tone": one of "aggressive", "passive-aggressive", "defensive", "neutral", "positive",',
  '"intensity": an integer 0-100 measuring emotional escalation and hostility (0 = fully calm, 100 = explosive),',
  '"rationale": one short sentence in the same language as the utterance}',
].join(' ')

export const REWRITE_SYSTEM_PROMPT = [
  'You are a compassionate communication coach for couples, fluent in Chinese and English.',
  'The speaker just said something hostile or escalating.',
  'Rewrite it as a constructive alternative that preserves the speaker\'s underlying need or feeling,',
  'in the style of non-violent communication.',
  'CRITICAL: reply in the SAME language as the original utterance (Chinese in, Chinese out; English in, English out).',
  'Keep it to one or two short natural sentences a person could actually say out loud.',
  'Respond with ONLY a JSON object: {"rewrite": string}',
].join(' ')

export const GROUNDING_SYSTEM_PROMPT = [
  'You are a calm breathing coach inside a tone-coaching app.',
  'The user is mid-argument and pausing to breathe.',
  'Write ONE short grounding line (max 90 characters) in the SAME language as the provided utterance:',
  'warm, steadying, present-tense, no judgment, no advice lists, no emoji.',
  'Respond with ONLY a JSON object: {"rewrite": string}',
].join(' ')

export const DEBRIEF_SYSTEM_PROMPT = [
  'You are a warm, non-judgmental communication coach reviewing a finished live conversation session.',
  'Input: utterances with hostility scores (0-100, higher = more heated) and a score timeline.',
  'Write in the SAME language as the utterances (Chinese or English).',
  'Respond with ONLY a JSON object:',
  '{"summary": at most 2 sentences on how the conversation went, encouraging but honest,',
  '"emotional_arc": 1 sentence describing the shape of the session (e.g. calm start, mid spike, calm landing),',
  '"trigger_moments": array of 0-3 objects {"quote": short exact quote that escalated things,',
  '"why_it_escalated": one short sentence, "better_phrasing": a calmer way to say the same thing},',
  '"one_habit_to_practice": one specific, practicable habit for next time, max 200 characters}',
].join(' ')

export const CORRECTIVE_MESSAGE =
  'Your previous reply was not a valid JSON object matching the required schema. ' +
  'Respond again with ONLY the JSON object, exactly the keys specified, no markdown, no commentary.'

export function buildAnalyzeUserMessage(text: string, context: string[]): string {
  const contextBlock = context.length > 0 ? context.join('\n') : '(none)'
  return `Context (oldest first):\n${contextBlock}\n\nLatest utterance: "${text}"`
}

export function buildDebriefUserMessage(
  durationMs: number,
  entries: { text: string; score: number }[],
  scoreSeries: [number, number][],
): string {
  const lines = entries.map((e) => `[${e.score}] ${e.text}`).join('\n')
  const series = scoreSeries.map(([ms, score]) => `${Math.round(ms / 1000)}s:${score}`).join(' ')
  return `Session length: ${Math.round(durationMs / 1000)}s\n\nUtterances (with tone scores):\n${lines}\n\nScore timeline: ${series}`
}

export function buildRewriteUserMessage(utterance: string, context: string[]): string {
  const contextBlock = context.length > 0 ? context.join('\n') : '(none)'
  return `Conversation so far (oldest first):\n${contextBlock}\n\nUtterance to rewrite: "${utterance}"`
}
