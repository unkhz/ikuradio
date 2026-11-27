// Rare, unusual words outside ordinary English vocabulary whose pronunciation
// needs explicit Chimera IPA syllables rather than English CMUdict guessing.
//
// Popped up occasionally as chorus rhymes (and now and then in verse trays) to
// lift the weirdness of the song: forgotten Nordic/Kalevala terms, alchemical
// vessels, archaic astronomy, mythic creatures, and strange instruments.
//
// Every entry carries:
//   - word:     display spelling (never ordinary English, always timeless)
//   - gloss:    tiny 2–5 word meaning shown to The Mind so it uses the word aptly
//   - ipa:      compact IPA syllables parsed by vocals/scat (verified in Chimera WASM)
//   - stresses: syllable stress weights (1 primary, 2 secondary, 0 unstressed)
//   - arpa:     ARPAbet sounds matching the word's rhyme tail for Rhymes/stressOf

export type SpecialWord = {
  readonly word: string
  readonly gloss: string
  readonly ipa: readonly string[]
  readonly stresses: readonly number[]
  readonly arpa: readonly string[]
}

export const specialWords: readonly SpecialWord[] = [
  // --- Rhymes with "one" (AH N) ---
  { word: 'carillon', gloss: 'tower of tuned bronze bells', ipa: ['kæ', 'ɾɪ', 'lʌn'], stresses: [1, 0, 2], arpa: ['K', 'AE1', 'R', 'IH0', 'L', 'AH2', 'N'] },
  { word: 'eidolon', gloss: 'phantom double or apparition', ipa: ['aɪ', 'doʊ', 'lʌn'], stresses: [0, 1, 2], arpa: ['AY0', 'D', 'OW1', 'L', 'AH2', 'N'] },
  { word: 'myrmidon', gloss: 'tireless iron-clad follower', ipa: ['mɝ', 'mɪ', 'dʌn'], stresses: [1, 0, 2], arpa: ['M', 'ER1', 'M', 'IH0', 'D', 'AH2', 'N'] },
  { word: 'jötunn', gloss: 'ancient Norse frost giant', ipa: ['jø', 'tʌn'], stresses: [1, 2], arpa: ['Y', 'UH1', 'T', 'AH2', 'N'] },

  // --- Rhymes with "two" (UW) ---
  { word: 'tonttu', gloss: 'quiet Finnish hearth spirit', ipa: ['ton', 'tuː'], stresses: [1, 2], arpa: ['T', 'AO1', 'N', 'T', 'UW2'] },
  { word: 'kaiku', gloss: 'Finnish word for an echo', ipa: ['kaɪ', 'kuː'], stresses: [1, 2], arpa: ['K', 'AY1', 'K', 'UW2'] },
  { word: 'manitou', gloss: 'Algonquian spirit of the wild', ipa: ['mæ', 'nɪ', 'tuː'], stresses: [1, 0, 2], arpa: ['M', 'AE1', 'N', 'IH0', 'T', 'UW2'] },
  { word: 'xanadu', gloss: 'fabled palace of distant wonders', ipa: ['zæ', 'nə', 'duː'], stresses: [1, 0, 2], arpa: ['Z', 'AE1', 'N', 'AH0', 'D', 'UW2'] },
  { word: 'tengu', gloss: 'winged mountain trickster spirit', ipa: ['teŋ', 'guː'], stresses: [1, 2], arpa: ['T', 'EH1', 'NG', 'G', 'UW2'] },
  { word: 'didgeridoo', gloss: 'hollowed eucalyptus drone pipe', ipa: ['dɪ', 'dʒə', 'ɾi', 'duː'], stresses: [2, 0, 0, 1], arpa: ['D', 'IH2', 'JH', 'ER0', 'IY0', 'D', 'UW1'] },

  // --- Rhymes with "three" (IY) ---
  { word: 'syzygy', gloss: 'three worlds aligned in orbit', ipa: ['sɪ', 'zɪ', 'dʒiː'], stresses: [1, 0, 2], arpa: ['S', 'IH1', 'Z', 'IH0', 'JH', 'IY2'] },
  { word: 'orrery', gloss: 'clockwork model of the planets', ipa: ['ɔ', 'ɾə', 'ɾiː'], stresses: [1, 0, 2], arpa: ['AO1', 'R', 'ER0', 'IY2'] },
  { word: 'tunturi', gloss: 'treeless Arctic Finnish fell', ipa: ['tun', 'tu', 'ɾiː'], stresses: [1, 0, 2], arpa: ['T', 'UW1', 'N', 'T', 'UW0', 'R', 'IY2'] },
  { word: 'revontuli', gloss: 'fox-fire northern lights', ipa: ['re', 'von', 'tu', 'liː'], stresses: [1, 0, 2, 2], arpa: ['R', 'EH1', 'V', 'AO0', 'N', 'T', 'UW0', 'L', 'IY2'] },
  { word: 'sastrugi', gloss: 'wind-carved ridges of hard snow', ipa: ['sæs', 'tɾu', 'giː'], stresses: [0, 1, 2], arpa: ['S', 'AE0', 'S', 'T', 'R', 'UW1', 'G', 'IY2'] },
  { word: 'sarangi', gloss: 'bowed voice-like Indian fiddle', ipa: ['sɑ', 'ɾɑŋ', 'giː'], stresses: [0, 1, 2], arpa: ['S', 'AA0', 'R', 'AA1', 'NG', 'G', 'IY2'] },
  { word: 'apogee', gloss: 'farthest point of an orbit', ipa: ['æ', 'pə', 'dʒiː'], stresses: [1, 0, 2], arpa: ['AE1', 'P', 'AH0', 'JH', 'IY2'] },
  { word: 'perigee', gloss: 'nearest sweep of an orbit', ipa: ['pɛ', 'ɾɪ', 'dʒiː'], stresses: [1, 0, 2], arpa: ['P', 'EH1', 'R', 'IH0', 'JH', 'IY2'] },
  { word: 'valkyrie', gloss: 'winged chooser of the fallen', ipa: ['væl', 'kɪ', 'ɾiː'], stresses: [1, 0, 2], arpa: ['V', 'AE1', 'L', 'K', 'IH0', 'R', 'IY2'] },
  { word: 'selkie', gloss: 'seal-folk who shed their pelts', ipa: ['sɛl', 'kiː'], stresses: [1, 2], arpa: ['S', 'EH1', 'L', 'K', 'IY2'] },
  { word: 'kelpie', gloss: 'shape-shifting water horse', ipa: ['kɛl', 'piː'], stresses: [1, 2], arpa: ['K', 'EH1', 'L', 'P', 'IY2'] },
  { word: 'louhi', gloss: 'sorceress of the northern dark', ipa: ['loʊ', 'hiː'], stresses: [1, 2], arpa: ['L', 'OW1', 'HH', 'IY2'] },

  // --- Rhymes with "four" (AO R) ---
  { word: 'athanor', gloss: 'alchemist self-feeding furnace', ipa: ['æ', 'θə', 'nɔr'], stresses: [1, 0, 2], arpa: ['AE1', 'TH', 'AH0', 'N', 'AO2', 'R'] },
  { word: 'petrichor', gloss: 'scent of rain on dry stone', ipa: ['pɛ', 'tɾɪ', 'kɔr'], stresses: [1, 0, 2], arpa: ['P', 'EH1', 'T', 'R', 'IH0', 'K', 'AO2', 'R'] },
  { word: 'manticore', gloss: 'chimeric beast with singing jaws', ipa: ['mæn', 'tɪ', 'kɔr'], stresses: [1, 0, 2], arpa: ['M', 'AE1', 'N', 'T', 'IH0', 'K', 'AO2', 'R'] },
  { word: 'hellebore', gloss: 'pale flower blooming in snow', ipa: ['hɛ', 'lə', 'bɔr'], stresses: [1, 0, 2], arpa: ['HH', 'EH1', 'L', 'AH0', 'B', 'AO2', 'R'] },
  { word: 'semaphore', gloss: 'distant lantern or arm signal', ipa: ['sɛ', 'mə', 'fɔr'], stresses: [1, 0, 2], arpa: ['S', 'EH1', 'M', 'AH0', 'F', 'AO2', 'R'] },
  { word: 'troubadour', gloss: 'wandering singer of riddles', ipa: ['tɾu', 'bə', 'dɔr'], stresses: [1, 0, 2], arpa: ['T', 'R', 'UW1', 'B', 'AH0', 'D', 'AO2', 'R'] },

  // --- Rhymes with "five" (AY V) ---
  { word: 'ogive', gloss: 'pointed Gothic stone arch', ipa: ['oʊ', 'dʒaɪv'], stresses: [1, 2], arpa: ['OW1', 'JH', 'AY2', 'V'] },
  { word: 'endive', gloss: 'bitter winter-blanched leaf', ipa: ['ɛn', 'daɪv'], stresses: [1, 2], arpa: ['EH1', 'N', 'D', 'AY2', 'V'] },

  // --- Rhymes with "six" (IH K S) ---
  { word: 'styx', gloss: 'black river of the underworld', ipa: ['stɪks'], stresses: [1], arpa: ['S', 'T', 'IH1', 'K', 'S'] },
  { word: 'calyx', gloss: 'green chalice holding a bud', ipa: ['keɪ', 'lɪks'], stresses: [1, 2], arpa: ['K', 'EY1', 'L', 'IH2', 'K', 'S'] },
  { word: 'sardonyx', gloss: 'banded crimson and ivory stone', ipa: ['sɑr', 'dɒ', 'nɪks'], stresses: [1, 0, 2], arpa: ['S', 'AA1', 'R', 'D', 'AA0', 'N', 'IH2', 'K', 'S'] },
  { word: 'prolix', gloss: 'unendingly wordy and spun out', ipa: ['pɾoʊ', 'lɪks'], stresses: [0, 1], arpa: ['P', 'R', 'OW0', 'L', 'IH1', 'K', 'S'] },

  // --- Rhymes with "seven" / "eleven" / "twelve" (EH V AH N / EH) ---
  { word: 'kantele', gloss: 'ancient Finnish plucked zither', ipa: ['kɑn', 'tɛ', 'lɛ'], stresses: [1, 0, 2], arpa: ['K', 'AA1', 'N', 'T', 'EH0', 'L', 'EH2'] },
  { word: 'velho', gloss: 'northern seer and spell-singer', ipa: ['vɛl', 'ho'], stresses: [1, 0], arpa: ['V', 'EH1', 'L', 'HH', 'OW0'] },
  { word: 'zephyr', gloss: 'soft west wind at dusk', ipa: ['zɛ', 'fəɹ'], stresses: [1, 0], arpa: ['Z', 'EH1', 'F', 'ER0'] },
  { word: 'vesper', gloss: 'evening bell or twilight star', ipa: ['vɛs', 'pəɹ'], stresses: [1, 0], arpa: ['V', 'EH1', 'S', 'P', 'ER0'] },
  { word: 'helve', gloss: 'ashwood handle of a woodsman axe', ipa: ['hɛlv'], stresses: [1], arpa: ['HH', 'EH1', 'L', 'V'] },

  // --- Rhymes with "eight" (EY T) ---
  { word: 'coruscate', gloss: 'flash and shimmer in the dark', ipa: ['kɒ', 'ɾəs', 'keɪt'], stresses: [1, 0, 2], arpa: ['K', 'AO1', 'R', 'AH0', 'S', 'K', 'EY2', 'T'] },
  { word: 'tessellate', gloss: 'tile space without a single seam', ipa: ['tɛ', 'sə', 'leɪt'], stresses: [1, 0, 2], arpa: ['T', 'EH1', 'S', 'AH0', 'L', 'EY2', 'T'] },
  { word: 'sublimate', gloss: 'pass straight from ice to vapor', ipa: ['sʌb', 'lɪ', 'meɪt'], stresses: [1, 0, 2], arpa: ['S', 'AH1', 'B', 'L', 'IH0', 'M', 'EY2', 'T'] },
  { word: 'fulminate', gloss: 'flare suddenly like dry lightning', ipa: ['fʊl', 'mɪ', 'neɪt'], stresses: [1, 0, 2], arpa: ['F', 'UH1', 'L', 'M', 'IH0', 'N', 'EY2', 'T'] },

  // --- Rhymes with "nine" (AY N) ---
  { word: 'vespertine', gloss: 'awakening only at twilight', ipa: ['vɛs', 'pəɹ', 'taɪn'], stresses: [1, 0, 2], arpa: ['V', 'EH1', 'S', 'P', 'ER0', 'T', 'AY2', 'N'] },
  { word: 'celestine', gloss: 'pale sky-blue mineral crystal', ipa: ['sɛ', 'ləs', 'taɪn'], stresses: [1, 0, 2], arpa: ['S', 'EH1', 'L', 'AH0', 'S', 'T', 'AY2', 'N'] },
  { word: 'adamantine', gloss: 'unbreakable diamond-hard sheen', ipa: ['æ', 'də', 'mæn', 'taɪn'], stresses: [2, 0, 1, 2], arpa: ['AE2', 'D', 'AH0', 'M', 'AE1', 'N', 'T', 'AY2', 'N'] },
  { word: 'eglantine', gloss: 'wild sweet-briar rose', ipa: ['ɛg', 'lən', 'taɪn'], stresses: [1, 0, 2], arpa: ['EH1', 'G', 'L', 'AH0', 'N', 'T', 'AY2', 'N'] },

  // --- Rhymes with "ten" (EH N) ---
  { word: 'dolmen', gloss: 'ancient stone portal tomb', ipa: ['doʊl', 'mɛn'], stresses: [1, 2], arpa: ['D', 'OW1', 'L', 'M', 'EH2', 'N'] },
  { word: 'cyclamen', gloss: 'nodding winter-blooming flower', ipa: ['saɪ', 'klə', 'mɛn'], stresses: [1, 0, 2], arpa: ['S', 'AY1', 'K', 'L', 'AH0', 'M', 'EH2', 'N'] },
  { word: 'kraken', gloss: 'sleeper beneath the deep trench', ipa: ['kɾɑ', 'kɛn'], stresses: [1, 2], arpa: ['K', 'R', 'AA1', 'K', 'EH2', 'N'] },
  { word: 'saracen', gloss: 'old star-charted desert voyager', ipa: ['sæ', 'ɾə', 'sɛn'], stresses: [1, 0, 2], arpa: ['S', 'AE1', 'R', 'AH0', 'S', 'EH2', 'N'] },

  // --- Rhymes with "thirteen..nineteen" (IY N) ---
  { word: 'undine', gloss: 'translucent spirit of still water', ipa: ['ʌn', 'diːn'], stresses: [1, 2], arpa: ['AH1', 'N', 'D', 'IY2', 'N'] },
  { word: 'palanquin', gloss: 'curtained litter carried aloft', ipa: ['pæ', 'ləŋ', 'kiːn'], stresses: [1, 0, 2], arpa: ['P', 'AE1', 'L', 'AH0', 'NG', 'K', 'IY2', 'N'] },
  { word: 'tourmaline', gloss: 'electric prism crystal', ipa: ['tʊr', 'mə', 'liːn'], stresses: [1, 0, 2], arpa: ['T', 'UH1', 'R', 'M', 'AH0', 'L', 'IY2', 'N'] },
  { word: 'serotine', gloss: 'late-flying dusk bat', ipa: ['sɛ', 'ɾə', 'tiːn'], stresses: [1, 0, 2], arpa: ['S', 'EH1', 'R', 'AH0', 'T', 'IY2', 'N'] },
  { word: 'silene', gloss: 'night-opening campion blossom', ipa: ['saɪ', 'liːn'], stresses: [0, 1], arpa: ['S', 'AY0', 'L', 'IY1', 'N'] },

  // --- Rhymes with "hundred" / "thousand" / "million..nonillion" & standalone rarities ---
  { word: 'penumbra', gloss: 'half-shadow rim of an eclipse', ipa: ['pə', 'nʌm', 'bɾə'], stresses: [0, 1, 0], arpa: ['P', 'AH0', 'N', 'AH1', 'M', 'B', 'R', 'AH0'] },
  { word: 'homunculus', gloss: 'tiny alchemical clockwork soul', ipa: ['hoʊ', 'mʌŋ', 'kju', 'ləs'], stresses: [0, 1, 0, 0], arpa: ['HH', 'OW0', 'M', 'AH1', 'NG', 'K', 'Y', 'UW0', 'L', 'AH0', 'S'] },
  { word: 'draugr', gloss: 'barrows-guarding Norse revenant', ipa: ['dɾaʊ', 'gər'], stresses: [1, 0], arpa: ['D', 'R', 'AW1', 'G', 'ER0'] },
  { word: 'triskelion', gloss: 'three-legged ancient spiral', ipa: ['tɾɪs', 'kɪl', 'jən'], stresses: [0, 1, 0], arpa: ['T', 'R', 'IH0', 'S', 'K', 'IH1', 'L', 'Y', 'AH0', 'N'] },
  { word: 'aphelion', gloss: 'orbit point farthest from the sun', ipa: ['ə', 'fiːl', 'jən'], stresses: [0, 1, 0], arpa: ['AH0', 'F', 'IY1', 'L', 'Y', 'AH0', 'N'] },
  { word: 'vermilion', gloss: 'cinnabar-ground crimson pigment', ipa: ['vər', 'mɪl', 'jən'], stresses: [0, 1, 0], arpa: ['V', 'ER0', 'M', 'IH1', 'L', 'Y', 'AH0', 'N'] },
  { word: 'ikuradio', gloss: 'eternal adrift signal in the void', ipa: ['i', 'ku', 'ɾɑ', 'di', 'o'], stresses: [1, 0, 2, 0, 0], arpa: ['IY1', 'K', 'UW0', 'R', 'AA2', 'D', 'IY0', 'OW0'] },
  { word: 'jouhikko', gloss: 'horsehair-strung Finnish bowed lyre', ipa: ['joʊ', 'hɪk', 'ko'], stresses: [1, 0, 0], arpa: ['Y', 'OW1', 'HH', 'IH0', 'K', 'OW0'] },
  { word: 'löyly', gloss: 'living steam rising from hot stone', ipa: ['lø', 'ly'], stresses: [1, 0], arpa: ['L', 'UH1', 'L', 'UW0'] },
  { word: 'kaamos', gloss: 'sunless blue polar winter', ipa: ['kɑː', 'mos'], stresses: [1, 0], arpa: ['K', 'AA1', 'M', 'AO0', 'S'] },
  { word: 'sampo', gloss: 'mythic mill of endless abundance', ipa: ['sɑm', 'po'], stresses: [1, 0], arpa: ['S', 'AA1', 'M', 'P', 'OW0'] },
  { word: 'tuonela', gloss: 'dark swan-river land of the dead', ipa: ['tu', 'o', 'ne', 'lɑ'], stresses: [1, 0, 2, 0], arpa: ['T', 'UW1', 'OW0', 'N', 'EH2', 'L', 'AA0'] },
  { word: 'nyckelharpa', gloss: 'keyed Swedish resonant fiddle', ipa: ['ny', 'kel', 'hɑr', 'pɑ'], stresses: [1, 0, 2, 0], arpa: ['N', 'IY1', 'K', 'EH0', 'L', 'HH', 'AA2', 'R', 'P', 'AA0'] },
  { word: 'chthonic', gloss: 'belonging to the deep underworld', ipa: ['θɒ', 'nɪk'], stresses: [1, 0], arpa: ['TH', 'AA1', 'N', 'IH0', 'K'] },
  { word: 'azoth', gloss: 'alchemical mercury of transmutation', ipa: ['æ', 'zɒθ'], stresses: [1, 2], arpa: ['AE1', 'Z', 'AA2', 'TH'] },
  { word: 'ouroboros', gloss: 'serpent devouring its own tail', ipa: ['u', 'ɾə', 'bɔ', 'ɾəs'], stresses: [0, 0, 1, 0], arpa: ['UW0', 'R', 'AH0', 'B', 'AO1', 'R', 'AH0', 'S'] },
  { word: 'cenote', gloss: 'sunken limestone well of clear blue', ipa: ['sɛ', 'noʊ', 'teɪ'], stresses: [0, 1, 0], arpa: ['S', 'EH0', 'N', 'OW1', 'T', 'EY0'] },
  { word: 'fumarole', gloss: 'volcanic vent exhaling sulfur steam', ipa: ['fju', 'mə', 'ɾoʊl'], stresses: [1, 0, 2], arpa: ['F', 'Y', 'UW1', 'M', 'AH0', 'R', 'OW2', 'L'] },
]

/** Lookup map of special words by lowercase display spelling. */
export const specialByWord: ReadonlyMap<string, SpecialWord> = new Map(
  specialWords.map((entry) => [entry.word.toLowerCase(), entry]),
)

export const isSpecialWord = (word: string): boolean => specialByWord.has(word.toLowerCase())

/** Draws `count` distinct special words for a verse tray, avoiding recently worn words. */
export function drawSpecialWords(
  count: number,
  avoid: readonly string[] = [],
  random: () => number = Math.random,
): SpecialWord[] {
  const skip = new Set(avoid.map((w) => w.toLowerCase()))
  const pool = specialWords.filter((e) => !skip.has(e.word.toLowerCase()))
  const list = [...(pool.length >= count ? pool : specialWords)]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
  return list.slice(0, count)
}
