import { describe, expect, it } from 'vitest'
import { filterTranscript, isSilentSegment } from './sttFilters'

describe('isSilentSegment', () => {
  it('gates segments below both thresholds', () => {
    expect(isSilentSegment(4, 11)).toBe(true)
  })

  it('passes segments with a loud peak even when the mean is low', () => {
    expect(isSilentSegment(4, 40)).toBe(false)
  })

  it('passes sustained moderate audio', () => {
    expect(isSilentSegment(6, 11)).toBe(false)
  })
})

describe('filterTranscript', () => {
  it('drops the zh subtitle hallucination observed live in production testing', () => {
    expect(filterTranscript('请不吝点赞 订阅 转发 打赏支持明镜与点点栏目', 60)).toBeNull()
  })

  it('drops classic English silence hallucinations', () => {
    expect(filterTranscript('Thank you.', 60)).toBeNull()
    expect(filterTranscript('thanks for watching!', 60)).toBeNull()
  })

  it('drops empty and whitespace-only results', () => {
    expect(filterTranscript('   ', 60)).toBeNull()
  })

  it('drops tiny results from near-silent segments', () => {
    expect(filterTranscript('Hey.', 10)).toBeNull()
  })

  it('keeps tiny results when the segment was clearly audible', () => {
    expect(filterTranscript('Hey.', 60)).toBe('Hey.')
  })

  it('keeps real hostile speech untouched', () => {
    expect(filterTranscript('你怎么又迟到了，烦死了', 70)).toBe('你怎么又迟到了，烦死了')
  })
})
