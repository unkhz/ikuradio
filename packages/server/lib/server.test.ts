import { recordingPath } from './server.js'

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
