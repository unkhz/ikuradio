import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { arrangementsHome } from 'parts'
import { formatArrangement } from './format.js'

describe('the file an Arrangement is saved as', () => {
  it('is the file as it is written: every Arrangement in the repository, read and formatted, is the same text', () => {
    const folders = readdirSync(arrangementsHome, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    expect(folders.length).toBeGreaterThan(1)
    for (const { name } of folders) {
      const text = readFileSync(join(arrangementsHome, name, 'arrangement.json'), 'utf8')
      expect(formatArrangement(JSON.parse(text))).toBe(text)
    }
  })

  it('puts the keys in their order whatever order they were made in, and says an empty list as one', () => {
    const made = { instances: [{ part: 'verse', name: 'a', ending: 'half', seconds: 2 }], title: 'T', id: 'x', turns: [], blocks: [{ gain: 1, to: { edge: 'end', region: 'a' }, from: { plus: 1, edge: 'start' }, key: 'k', track: 't' }] }
    expect(formatArrangement(made)).toBe(
      '{\n  "id": "x",\n  "title": "T",\n  "instances": [\n    { "name": "a", "part": "verse", "seconds": 2, "ending": "half" }\n  ],\n  "turns": [],\n  "blocks": [\n    { "track": "t", "key": "k", "from": { "edge": "start", "plus": 1 }, "to": { "region": "a", "edge": "end" }, "gain": 1 }\n  ]\n}\n',
    )
  })
})
