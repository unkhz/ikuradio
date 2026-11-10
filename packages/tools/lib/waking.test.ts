import { describe, it, expect } from 'bun:test'
import { mindArguments } from './waking.js'

describe('mindArguments', () => {
  const args = mindArguments({
    model: '/song/models/mind.gguf',
    host: '127.0.0.1',
    port: 8088,
    context: 2048,
    slots: 5,
  })
  const value = (flag: string) => args[args.indexOf(flag) + 1]

  it('puts the whole mind on the GPU, with flash attention', () => {
    expect(value('--n-gpu-layers')).toBe('999')
    expect(value('--flash-attn')).toBe('on')
  })

  it('answers five questions at once, each with its own context', () => {
    expect(value('--parallel')).toBe('5')
    expect(value('--ctx-size')).toBe(`${2048 * 5}`)
  })

  it('listens only on the machine itself', () => {
    expect(value('--host')).toBe('127.0.0.1')
    expect(value('--port')).toBe('8088')
    expect(value('--model')).toBe('/song/models/mind.gguf')
  })
})
