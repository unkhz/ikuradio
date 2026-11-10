import { Room, type Listener } from './room.js'

class Ear implements Listener {
  heard = ''
  writableLength = 0
  ended = false
  private closers: (() => void)[] = []
  write(chunk: string) {
    this.heard += chunk
    return true
  }
  end() {
    this.ended = true
  }
  on(_: 'close', handler: () => void) {
    this.closers.push(handler)
  }
  leave() {
    this.closers.forEach((close) => close())
  }
}

describe('Room', () => {
  it('lets listeners hear what is sung while they are there', () => {
    const room = new Room()
    const ear = new Ear()
    room.enter(ear)
    room.say('H')
    room.say('i')
    expect(ear.heard).toBe('H\ni\n')
  })

  it('shows a newcomer the weather and the words so far, but no sounds', () => {
    const room = new Room()
    room.turnPage(['~ eternity ~', '<br>', '<br>'])
    room.say('play:audio/vocals/a.m4a')
    room.say('W')
    room.say('e')
    const late = new Ear()
    room.enter(late)
    expect(late.heard).toBe('~ eternity ~\n<br>\n<br>\nW\ne\n')
  })

  it('forgets the last iteration when a new one begins', () => {
    const room = new Room()
    room.say('old')
    room.turnPage(['~ dub ~'])
    room.say('new')
    const late = new Ear()
    room.enter(late)
    expect(late.heard).toBe('~ dub ~\nnew\n')
  })

  it('sings to the walls when nobody is there, and remembers only the iteration', () => {
    const room = new Room()
    for (let i = 0; i < 10_000; i++) {
      room.turnPage(['~ weather ~'])
      room.say(`word ${i}`)
    }
    const late = new Ear()
    room.enter(late)
    expect(late.heard).toBe('~ weather ~\nword 9999\n')
  })

  it('lets go of listeners who leave', () => {
    const room = new Room()
    const ear = new Ear()
    room.enter(ear)
    ear.leave()
    room.say('gone')
    expect(ear.heard).toBe('')
    expect(room.size).toBe(0)
  })

  it('lets go of listeners who cannot keep up', () => {
    const room = new Room()
    const slow = new Ear()
    slow.writableLength = 2 * 1024 * 1024
    room.enter(slow)
    room.say('too late')
    expect(slow.ended).toBe(true)
    expect(room.size).toBe(0)
  })

  it('gives a newcomer the score of what comes next, until it begins', () => {
    const room = new Room()
    room.turnPage(['~ dub ~'])
    room.say('W')
    room.announce('score:{"iteration":"1"}')
    const early = new Ear()
    room.enter(early)
    expect(early.heard).toBe('~ dub ~\nW\nscore:{"iteration":"1"}\n')
    room.turnPage(['~ dub ~'])
    room.say('begin:1')
    const late = new Ear()
    room.enter(late)
    expect(late.heard).toBe('~ dub ~\n')
  })

  it('shows everyone out when it closes', () => {
    const room = new Room()
    const ears = [new Ear(), new Ear()]
    ears.forEach((ear) => room.enter(ear))
    room.say('rest:the song is resting')
    room.close()
    expect(ears.every((ear) => ear.ended)).toBe(true)
    expect(ears[0].heard).toBe('rest:the song is resting\n')
    expect(room.size).toBe(0)
  })
})
