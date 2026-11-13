// The Session: the complete declaration of a Song, as the Studio leaves it in
// the Archive. Everything a Receiver needs to play the Song is here: what it
// is, every Recording and the moment it begins, and every character of every
// line and the moment it is typed. A Receiver that has the Session, the
// Recordings and the Tactus needs nothing else, and can play the Song from
// any moment in it.
//
// All moments are in seconds from the beginning of the Song.
//
// A voice is not kept as sound. It is kept as its source: the score its
// singer sang, every note and every small wrongness of the take, exactly as
// the throat was given it. A Receiver sings it with the same throat (Chimera,
// compiled to WebAssembly) and hears what the Studio heard, sample for sample.
// Only the Music is kept as sound. Songs from before this have their voices
// as Recordings, and no takes.

export const sessionVersion = 1

export type Session = {
  version: typeof sessionVersion
  /** Which Song this is, counted from 0. */
  song: string
  /** The weather it is sung in. */
  mood: string[]
  mode: string
  tempo: number
  /** The band the mind heard in the Mood, if it heard one. */
  sound?: string
  /** Who sings it, for anyone watching. */
  choir: string
  /**
   * The Perspectives the Song is heard from: ways it differs from the usual,
   * each with the part of the Studio's work it changed, and the variant
   * chosen, if any. For anyone watching: everything they changed is already
   * in the parts, takes and beds. Missing on Songs from before Perspectives.
   */
  perspectives?: SessionPerspective[]
  /**
   * What the mind thought, once it had written the Song's words: for
   * itself to remember, and for anyone watching to read. Missing on Songs
   * from before the mind kept its thoughts, and on Songs it was silent
   * about.
   */
  thought?: string
  /**
   * The singers, the lead first: a Receiver places each where it likes in
   * its mix. A voice Recording names its singer by place in this list.
   */
  singers: { body: 'female' | 'male' | 'child'; harmony: number }[]
  /**
   * The throat its voices are sung with: Chimera's revision and the song's
   * patch to it, as `<revision>+<patch>`. A Receiver sings with the throat it
   * has, which is the same one unless the throat has been moved on since.
   */
  throat?: string
  /** How long the whole Song lasts. */
  seconds: number
  iterations: SessionIteration[]
  /** Everything audible, each at its moment. */
  recordings: SessionRecording[]
  /**
   * The guide hums the Music grew its beds from: the lead humming a part's
   * melody with fewer notes. They are not part of the Song, and a Receiver
   * never plays them; they are kept so that anyone may hear what the Music
   * was listening to.
   */
  guides?: SessionGuide[]
}

/** A Perspective a Song is heard from: its name and title, the Facet it turned, and the variant chosen. */
export type SessionPerspective = { slug: string; title: string; facet: string; variant?: string }

/**
 * A take, exactly as the throat is given it: the notes in MIDI (cents and
 * all) and beats at `bpm`, a rest being 0 or less, the words read aloud, the
 * breath before the first note, the vibrato, and the singer's own throat.
 * The body that sings it is the singer's, in `singers`.
 */
export type SessionTake = {
  bpm: number
  lyrics: string
  notes: [number, number][]
  /** Seconds of breath before the first note. */
  t0?: number
  /** Vibrato depth in cents on held vowels. */
  vibrato?: number
  /** Lung pressure, in cmH2O. */
  pressure?: number
  /** 0 slack … 1 pressed. */
  tension?: number
  /** 0 clear … 1 all breath. */
  breathiness?: number
}

export type SessionGuide = {
  /** Its name: the hash of what was hummed. Guides sung from a take are not in the Archive's recordings. */
  id: string
  /** What the lead hummed, exactly as the throat was given it; the lead's body. */
  take?: SessionTake
  /** Only ever a guide for the Music, never to be played in the Song. */
  kind: 'guide'
  /** The part it guided the Music for. */
  part: 'verse' | 'chorus' | 'bridge'
  /** For a bridge: the part it leaves, and the part it leads to. */
  from?: 'verse' | 'chorus'
  to?: 'verse' | 'chorus'
  /** The section it was hummed against, from the Song's beginning; it goes on through the tail after. */
  at: number
  seconds: number
  /** What was hummed: its notes in MIDI and beats, at its tempo. */
  score: { bpm: number; notes: [number, number][] }
}

export type SessionIteration = {
  /** Which iteration this is, counted from 0. */
  iteration: string
  /** When it begins. */
  at: number
  seconds: number
  variation: number
  /** Where in its Song it stands, counted from one. */
  of: { at: number; of: number }
  parts: SessionPart[]
}

export type SessionPart = {
  type: 'verse' | 'chorus' | 'bridge'
  at: number
  seconds: number
  /** The words, a line at a time. A bridge has none. */
  lines: SessionLine[]
}

export type SessionLine = {
  text: string
  /** When the line's place in the music begins. */
  at: number
  /**
   * When each character is typed, in milliseconds from `at`; one more than
   * there are characters, the last being the line's end.
   */
  typing: number[]
}

export type SessionRecording = {
  /**
   * Its name: for a Recording in the Archive, its content as a hash; for a
   * voice with a take, the hash of the take, which nobody fetches.
   */
  id: string
  /**
   * For a voice: the take its singer sings, for the Receiver to sing. A
   * voice with a take is not in the Archive's recordings.
   */
  take?: SessionTake
  at: number
  /** How loud it is played, 1 being as recorded. */
  gain?: number
  kind: 'voice' | 'bed'
  /** Which singer sings it, a place in `singers`: 0 is the lead. Voices only. */
  voice?: number
  /** How long its place in the Song lasts, if the Studio knows: a Receiver arriving later need not fetch it. */
  seconds?: number
  /**
   * For a Recording that goes on past its place: how many seconds of tail
   * it has, to be faded out while what follows has already begun. Music
   * that goes on is never cut off; music that stops has a silent tail.
   */
  fade?: number
  /**
   * How loud it sounds, measured from the Recording itself after it was
   * made (EBU R128): integrated loudness in LUFS, true peak in dBTP. A
   * Receiver brings every Recording to the loudness it wants from this.
   */
  loudness?: { lufs: number; peak: number }
}

/** What the Archive holds: the Songs it has, oldest first. */
export type ArchiveIndex = {
  songs: string[]
}

/** Where things are, inside an Archive. */
export const paths = {
  index: 'index.json',
  session: (song: string) => `sessions/${song}.json`,
  recording: (id: string) => `recordings/${id}`,
  /** The diary's book being written in, copied afresh after every Song. */
  diary: 'diary/diary.jsonl',
  /** A closed book of the diary, named as it is on the shelf. It never changes. */
  diaryBook: (name: string) => `diary/books/${name}`,
  /** Where the diary's closed books are kept. */
  diaryShelf: 'diary/books/',
  /** A month of the mind's own thoughts, a thought a line, copied afresh after every Song. */
  thoughts: (month: string) => `thoughts/mind/${month}.jsonl`,
  /** Where the months of the mind's thoughts are kept. */
  thoughtsShelf: 'thoughts/mind/',
}
