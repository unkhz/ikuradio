import { expect, it } from 'bun:test'
import { isBare } from './bare.js'

it('is bare only when no iteration has a bed', () => {
  expect(isBare([{ beds: [] }, { beds: [] }])).toBe(true)
  expect(isBare([{ beds: [] }, { beds: [{}] }])).toBe(false)
})
