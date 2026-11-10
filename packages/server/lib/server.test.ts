import { lookBackQuery, recordingPath } from './server.js'

describe('recordingPath', () => {
  it('finds a recording on its shelf', () => {
    expect(recordingPath('/audio/vocals/fb27.m4a')).toBe(
      'audio/vocals/fb27.m4a',
    )
    expect(recordingPath('/audio/violin-music/music_1691953935.mp3?x=1')).toBe(
      'audio/violin-music/music_1691953935.mp3',
    )
  })

  it('never lets a request out of the audio shelves', () => {
    expect(recordingPath('/audio/../index.ts')).toBeUndefined()
    expect(recordingPath('/audio/vocals/../../.env')).toBeUndefined()
    expect(recordingPath('/audio/%2e%2e/memory/diary.jsonl')).toBeUndefined()
    expect(recordingPath('/')).toBeUndefined()
  })
})

describe('lookBackQuery', () => {
  it('reads before which iteration, and how many', () => {
    expect(lookBackQuery('/diary?before=412&count=5')).toEqual({
      before: 412n,
      count: 5,
    })
  })

  it('reads the most recent pages when nothing is asked', () => {
    expect(lookBackQuery('/diary')).toEqual({ before: undefined, count: 12 })
  })

  it('never reads too much, or anything that is not a number', () => {
    expect(lookBackQuery('/diary?count=100000').count).toBe(30)
    expect(lookBackQuery('/diary?count=0').count).toBe(1)
    expect(lookBackQuery('/diary?before=-1&count=x')).toEqual({
      before: undefined,
      count: 12,
    })
  })
})
