import { describe, expect, it } from 'bun:test'
import { known } from './known.js'

describe('known', () => {
  it('keeps only the words the mind reads whole', async () => {
    const pieces: Record<string, number> = { ' begun': 1, ' shippee': 3, ' shore': 1 }
    const plain = await known(['begun', 'shippee', 'shore'], async (t) => pieces[t])
    expect([...(plain ?? [])]).toEqual(['begun', 'shore'])
  })

  it('does not choose when the mind cannot say', async () => {
    const plain = await known(['unheard'], async () => {
      throw new Error('no mind')
    })
    expect(plain).toBeUndefined()
  })
})
