import { Type } from 'typebox'
import { chorusHook, type Phrase, type Tune } from 'melody'
import { chorusOpening } from 'song'
import { countOf, wordyMeasure } from '../lib/counting.js'
import { Part, type LineContext, type LineMeasure, type Place } from '../lib/part.js'
import { melody, wordiness } from '../lib/ranges.js'

/**
 * The chorus: written words, but for its first line, which is the Song's age and not the mind's;
 * sung to the tune's chorus phrases; ends at home. The counting is the chorus's: its first line is
 * counted from its phrase exactly, never touched by wordiness, and grows on its reciting note, a
 * bar at a time and with no ceiling, because the Song's age has more syllables every year.
 */
class Chorus extends Part {
  readonly id = 'chorus'
  readonly words = 'written'
  readonly ending = 'full'
  readonly parameters = Type.Object({ wordiness: wordiness(), ...melody() })

  measure({ line, tune, tempo, rate, parameters }: LineContext): LineMeasure {
    const phrase = tune.chorus[line % tune.chorus.length]!
    // the line that has a reciting note grows on it, a bar at a time: melody says which
    if (chorusHook[line % chorusHook.length]?.reciting !== undefined) return { ...countOf(phrase, tempo, rate), grows: true }
    return wordyMeasure(phrase, tempo, rate, this.given(parameters).wordiness!)
  }

  phrases(tune: Tune): Phrase[] {
    return tune.chorus
  }

  fixedLine(line: number, { iteration }: Place): string | undefined {
    return line === 0 ? chorusOpening(iteration) : undefined
  }
}

export default new Chorus()
