import { lastWord, parseDictionary, Rhymes, rhymeOf } from './rhyme.js'

// a few words, as the throat's dictionary writes them
const dictionary = parseDictionary(
  [
    'one\tW AH1 N',
    'begun\tB IH0 G AH1 N',
    'sun\tS AH1 N',
    'done\tD AH1 N',
    'two\tT UW1',
    'true\tT R UW1',
    'through\tTH R UW1',
    'blue\tB L UW1',
    'new\tN UW1',
    'view\tV Y UW1',
    'flew\tF L UW1',
    'knew\tN UW1',
    'grew\tG R UW1',
    'aloof\tAH0 L UW1 F',
    'nineteen\tN AY1 N T IY1 N',
    'between\tB IH0 T W IY1 N',
    'twelve\tT W EH1 L V',
    'delve\tD EH1 L V',
    'bell\tB EH1 L',
    'friend\tF R EH1 N D',
  ].join('\n'),
)
const rhymes = new Rhymes(dictionary)

describe('rhymeOf', () => {
  it('hears a word from its last stressed vowel to the end', () => {
    expect(rhymeOf(['B', 'IH0', 'G', 'AH1', 'N'])).toBe('AH N')
    expect(rhymeOf(['N', 'AY1', 'N', 'T', 'IY1', 'N'])).toBe('IY N')
  })
})

describe('Rhymes', () => {
  it('knows what rhymes with a number', () => {
    expect(rhymes.rhymes('one', 'begun')).toBe(true)
    expect(rhymes.rhymes('two', 'true')).toBe(true)
    expect(rhymes.rhymes('nineteen', 'between')).toBe(true)
    expect(rhymes.rhymes('two', 'begun')).toBe(false)
  })

  it('hears a looser rhyme only when asked to', () => {
    expect(rhymes.rhymes('two', 'aloof')).toBe(false)
    expect(rhymes.rhymes('two', 'aloof', true)).toBe(true)
  })

  it('does not let a word rhyme with itself', () => {
    expect(rhymes.rhymes('two', 'two')).toBe(false)
  })

  it('offers true rhymes when there are enough', () => {
    const { words, loosely } = rhymes.offer('two')
    expect(loosely).toBe(false)
    expect(words.sort()).toEqual(
      ['blue', 'flew', 'grew', 'knew', 'new', 'through', 'true', 'view'].sort(),
    )
  })

  it('offers the same vowel when true rhymes are too few', () => {
    const { words, loosely } = rhymes.offer('twelve')
    expect(loosely).toBe(true)
    expect(words.sort()).toEqual(['bell', 'delve', 'friend'])
  })
})

describe('lastWord', () => {
  it('finds the last word of a line, as the dictionary spells it', () => {
    expect(lastWord('This is the song, iteration twenty-two,')).toBe('two')
    expect(lastWord('Yes, it goes on and on, it’s just begun...')).toBe('begun')
  })
})
