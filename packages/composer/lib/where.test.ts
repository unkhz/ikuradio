import { describe, expect, it } from 'bun:test'
import { readParts, readTracks, readArrangements, refuseArrangement } from 'parts'
import { whereOf } from './where.js'

const records = await readParts()
const tracks = await readTracks()
const song = (await readArrangements(records, undefined, tracks)).find(({ arrangement }) => arrangement.id === 'the-song')!.arrangement

const refused = (change: (a: any) => void) => {
  const a = JSON.parse(JSON.stringify(song))
  change(a)
  const refusal = refuseArrangement(a, records, tracks)
  return refusal ? { refusal, where: whereOf(refusal) } : undefined
}

describe('what a refusal is about', () => {
  it('is the instance, the tempo change, the turn or the Block it names, counted from 0', () => {
    expect(refused((a) => (a.instances[3].parameters = { wordiness: 3 }))!.where).toEqual({ thing: 'instance', index: 3 })
    expect(refused((a) => (a.instances[1].name = 'verse-1'))!.where).toEqual({ thing: 'instance', index: 1 })
    expect(refused((a) => (a.blocks[2].gain = 1))!.where).toEqual({ thing: 'block', index: 2 })
    expect(refused((a) => (a.blocks[1].fadeOut = 100))!.where).toEqual({ thing: 'block', index: 1 })
    expect(refused((a) => (a.turns = [{ region: 'verse-1', edge: 'start' }]))!.where).toEqual({ thing: 'turn', index: 0 })
    expect(refused((a) => (a.tempo = [{ bpm: 'mood' }, { region: 'chorus', hearing: 9, bpm: 90 }]))!.where).toEqual({ thing: 'tempo', index: 1 })
    expect(refused((a) => (a.instances[5].seconds = 4))!.where).toEqual({ thing: 'instance', index: 5 })
  })

  it("is the thing a schema's path says, with the field, and a field of the Arrangement itself", () => {
    expect(refused((a) => (a.tempo[0].bpm = 5))!.where).toEqual({ thing: 'tempo', index: 0, field: 'bpm' })
    expect(refused((a) => (a.blocks[4].from.edge = 'middle'))!.where).toEqual({ thing: 'block', index: 4, field: 'from' })
    expect(refused((a) => (a.turns[0].hearing = 0))!.where).toEqual({ thing: 'turn', index: 0, field: 'hearing' })
    expect(refused((a) => (a.id = 'Bad Id'))!.where).toEqual({ thing: 'arrangement', field: 'id' })
    expect(refused((a) => (a.title = ''))!.where).toEqual({ thing: 'arrangement', field: 'title' })
    expect(refused((a) => (a.tracks = ['drums']))!.where).toMatchObject({ thing: 'arrangement', field: 'tracks' })
  })

  it('is nothing when it is about the whole', () => {
    expect(whereOf('an Arrangement is a small thing')).toBeUndefined()
  })
})
