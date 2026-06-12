// Cheap client-side token estimation for budget metering. Calibrated for
// Llama tokenizers: CJK ≈ 1 token/char, Latin ≈ 1.35 tokens/word.
// Deliberately rough — budgets charge output at max_completion_tokens and
// keep ~18% TPD headroom, so estimation error is absorbed, not compounded.

const CJK_RE = /[一-鿿]/g
const LATIN_WORD_RE = /[A-Za-z0-9']+/g

export function estimateTextTokens(text: string): number {
  const cjk = text.match(CJK_RE)?.length ?? 0
  const latinWords = text.match(LATIN_WORD_RE)?.length ?? 0
  return cjk + Math.ceil(latinWords * 1.35)
}

export function estimateTextsTokens(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + estimateTextTokens(text), 0)
}
