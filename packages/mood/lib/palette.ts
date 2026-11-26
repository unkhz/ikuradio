// Abundant musical palette for the ear (`character.ts`) and the weather (`forecast.ts`).
//
// Left with two examples, a small mind reaches for the same few instruments and
// poetic moods over and over. Rotating small random slices from this wide library
// gives each Song fresh sonic territory without dictating what it must pick.

import { resembles } from './resembles.js'
import { moodScenes, musicalStyles } from './weather.js'

/** Instrument selections grouped by acoustic/electronic family so each sample spans distinct colors. */
export const instruments = {
  bowed: [
    'violin',
    'viola',
    'cello',
    'double bass',
    'hardanger fiddle',
    'erhu',
    'nyckelharpa',
    'hurdy-gurdy',
    'viola da gamba',
    'bowed saw',
    'sarangi',
    'morin khuur',
    'string quartet',
    'muted strings',
    'pizzicato strings',
  ],
  plucked: [
    'acoustic guitar',
    'nylon classical guitar',
    'baritone electric guitar',
    'pedal steel guitar',
    'slide dobro',
    'twelve-string guitar',
    'electric jazz guitar',
    'fuzz bass guitar',
    'fretless bass',
    'upright pizzicato bass',
    'lute',
    'oud',
    'kora',
    'sitar',
    'koto',
    'shamisen',
    'banjo',
    'mandolin',
    'bouzouki',
    'balalaika',
    'charango',
    'concert harp',
    'celtic harp',
    'zither',
    'guzheng',
    'ukulele',
  ],
  keysAndSynths: [
    'felt upright piano',
    'grand piano',
    'tack piano',
    'prepared piano',
    'harpsichord',
    'clavichord',
    'celesta',
    'toy piano',
    'rhodes electric piano',
    'wurlitzer electric piano',
    'clavinet',
    'hammond b3 organ',
    'cathedral pipe organ',
    'pump harmonium',
    'reed organ',
    'accordion',
    'bandoneon',
    'concertina',
    'melodica',
    'mellotron',
    'analog modular synth',
    'warm juno synth pad',
    'moog sub bass',
    'fm electric bells',
    'buchla synth plucks',
    'acid 303 bass',
    'theremin',
    'ondes martenot',
  ],
  woodwinds: [
    'concert flute',
    'alto flute',
    'piccolo',
    'clarinet',
    'bass clarinet',
    'oboe',
    'english horn',
    'bassoon',
    'contrabassoon',
    'soprano saxophone',
    'alto saxophone',
    'tenor saxophone',
    'baritone saxophone',
    'shakuhachi',
    'duduk',
    'ney flute',
    'tin whistle',
    'uilleann pipes',
    'pan flute',
    'ocarina',
    'bass recorder',
  ],
  brass: [
    'muted trumpet',
    'flugelhorn',
    'cornet',
    'french horn',
    'trombone',
    'bass trombone',
    'euphonium',
    'tuba',
    'sousaphone',
    'alphorn',
    'brass section',
  ],
  tunedPercussion: [
    'marimba',
    'vibraphone',
    'xylophone',
    'glockenspiel',
    'tubular bells',
    'steelpan',
    'hang drum',
    'kalimba',
    'mbira',
    'balafon',
    'cimbalom',
    'hammered dulcimer',
    'gamelan bronze gongs',
    'glass harmonica',
    'tibetan bronze bowls',
    'music box',
  ],
  drumsAndPercussion: [
    'brushed jazz drum kit',
    'dry tight drum kit',
    'motorik snare and kick',
    'analog drum machine',
    '808 sub kick and rimshot',
    'taiko drums',
    'frame drum',
    'bodhran',
    'djembe',
    'tabla',
    'darbuka',
    'congas',
    'bongos',
    'cajon',
    'timpani',
    'orchestral bass drum',
    'marching snare',
    'woodblocks and claves',
    'shakers and tambourine',
    'finger cymbals',
    'gong',
  ],
  texturesAndFound: [
    'tape loops',
    'vinyl crackle',
    'spring reverb tank',
    'bowed cymbals',
    'waterphone',
    'shortwave radio hum',
    'church bells',
  ],
} as const

/** Flat list of every instrument in the palette. */
export const allInstruments = Object.values(instruments).flat()

/** Production, acoustic space, and rhythmic feel descriptors. */
export const textures = [
  'warm tape-saturated',
  'crisp close-miked',
  'cavernous cathedral',
  'dusty lo-fi cassette',
  'shimmering reverb-drenched',
  'bone-dry minimalist',
  'hypnotic motorik',
  'smoky late-night swung',
  'raw garage overdrive',
  'crystalline chamber',
  'dub-echoed spacious',
  'syncopated polyrhythmic',
  'delicate rubato',
  'thunderous ceremonial',
  'sun-baked analog',
  'glassy sparse',
  'gritty bowed acoustic',
  'lush orchestral',
  'intimate nocturnal',
  'funky pocket-tight',
  'metallic resonant',
  'foggy muted',
  'brisk staccato',
  'languid drifting',
  'wooden parlor',
  'buzzing psychedelic',
  'austere medieval',
  'bright sunlit',
  'subterranean booming',
  'glitchy granular',
  'brassy street-parade',
  'rolling nautical',
  'trance-locked hypnotic',
  'hazy shoegaze wall',
  'crackling vintage mono',
  'elastic dub-bass',
] as const

function pickDistinct<T>(pool: readonly T[], count: number, random: () => number): T[] {
  const copy = [...pool]
  const out: T[] = []
  const n = Math.min(count, copy.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    out.push(copy[i]!)
  }
  return out
}

export type SampledPalette = {
  styles: string[]
  instruments: string[]
  textures: string[]
}

/** Musical styles suited to instrumental band descriptions (excludes vocal/choral idioms so MusicGen never hallucinates voices). */
const vocalStylePattern = /\b(choir|quartet|chant|yodel|throat|polyphony|kulning|madrigal|qawwali|shanty|rhyme|ballad|troubadour)\b/i
export const instrumentalStyles = musicalStyles.filter((s) => !vocalStylePattern.test(s))

/**
 * Draws a fresh rotating slice of instrumental musical styles, cross-family instruments,
 * and sonic textures so each Song sees a wide, varied sonic palette.
 */
export function samplePalette(
  random: () => number = Math.random,
  { styleCount = 4, instrumentCount = 8, textureCount = 3 }: { styleCount?: number; instrumentCount?: number; textureCount?: number } = {},
): SampledPalette {
  const families = Object.values(instruments)
  const chosenFamilies = pickDistinct(families, Math.min(instrumentCount, families.length), random)
  const pickedInstruments: string[] = []
  const seen = new Set<string>()
  for (const family of chosenFamilies) {
    const one = family[Math.floor(random() * family.length)]
    if (one && !seen.has(one)) {
      seen.add(one)
      pickedInstruments.push(one)
    }
  }
  if (pickedInstruments.length < instrumentCount) {
    const rest = allInstruments.filter((inst) => !seen.has(inst))
    pickedInstruments.push(...pickDistinct(rest, instrumentCount - pickedInstruments.length, random))
  }
  return {
    styles: pickDistinct(instrumentalStyles, styleCount, random),
    instruments: pickedInstruments,
    textures: pickDistinct(textures, textureCount, random),
  }
}

/**
 * Draws fresh non-recent weather sparks (both musical styles and scenes),
 * excluding both exact matches and descriptions that resemble avoided weather.
 */
export function sampleSparks(
  avoid: readonly string[] = [],
  random: () => number = Math.random,
  { styles = 3, scenes = 3 }: { styles?: number; scenes?: number } = {},
): string[] {
  const skip = avoid.map((s) => s.trim().toLowerCase())
  const fresh = (candidate: string) => {
    const lower = candidate.toLowerCase()
    return !skip.some((a) => a === lower || resembles(a, lower))
  }
  const freshStyles = musicalStyles.filter(fresh)
  const freshScenes = moodScenes.filter(fresh)
  return [
    ...pickDistinct(freshStyles, styles, random),
    ...pickDistinct(freshScenes, scenes, random),
  ]
}
