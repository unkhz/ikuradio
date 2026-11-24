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
  /**
   * The Arrangement the Song was made as, by its folder id (e.g. `the-song`).
   * Missing on Songs made before Arrangements were recorded (all of which used `the-song`).
   */
  arrangement?: string
  /**
   * The human title of the Arrangement (from its record heading, e.g. `The Long Breath`).
   * Missing on older Songs; a Receiver falls back from `arrangement` when absent.
   */
  arrangementTitle?: string
  /**
   * Non-default Tracks active in the Song (e.g. `drone`, `pulse`), for anyone watching.
   * Missing on Songs with only the standard voice and bed tracks.
   */
  tracks?: string[]
  /**
   * The name the mind gave it, punctuation and all: the title of its page,
   * and the words of its link, which is made from the name alone, by
   * `slugOf`. Missing on Songs from before Songs had names.
   */
  name?: string
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
   * How many syllables a second the Song's voices could sing at most: no
   * syllable was sung sooner than 1 / rate seconds after the one before.
   * Missing on Songs from before there was a limit.
   */
  rate?: number
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
  /** Its intro, if it has one: Songs from before intros have none. */
  intro?: SessionIntro
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

/**
 * A spoken line, as Chimera's speaking throat says it: text, body, and optional voice settings.
 * Synthesized locally by every Receiver (and Studio) from the same WASM throat — never kept as audio in the Archive.
 */
export type SessionSpeech = {
  text: string
  body: 'female' | 'male' | 'child'
  f0?: number
  rate?: number
  pressure?: number
  tension?: number
  breathiness?: number
}

/**
 * A deterministic procedural sound (drone or pulse), synthesized locally from the Song's mode, tonic, chords and tempo —
 * never kept as audio in the Archive.
 */
export type SessionSynth =
  | {
      kind: 'drone'
      mode: string
      tonic: number
      seconds: number
      fadeIn?: number
      fade?: number
      chords?: { at: number; seconds: number; root: number; bass?: number }[]
      warmth?: number
      build?: number
      movement?: number
      octave?: number
      seed: string
    }
  | {
      kind: 'pulse'
      mode: string
      tonic: number
      bpm: number
      seconds: number
      fadeIn?: number
      fade?: number
      density?: number
      swing?: number
      tone?: number
      seed: string
    }
  | {
      kind: 'drums'
      style: 'tribal' | 'trance' | 'ritual'
      mode: string
      tonic: number
      bpm: number
      seconds: number
      fadeIn?: number
      fade?: number
      intensity?: number
      build?: number
      swing?: number
      halfTime?: number
      seed: string
    }

export type SessionGuide = {
  /** Its name: the hash of what was hummed. Guides sung from a take are not in the Archive's recordings. */
  id: string
  /** What the lead hummed, exactly as the throat was given it; the lead's body. */
  take?: SessionTake
  /** Only ever a guide for the Music, never to be played in the Song. */
  kind: 'guide'
  /** The part it guided the Music for. */
  part: string
  /** For a bridge: the part it leaves, and the part it leads to. */
  from?: string
  to?: string
  /** The section it was hummed against, from the Song's beginning; it goes on through the tail after. */
  at: number
  seconds: number
  /** What was hummed: its notes in MIDI and beats, at its tempo. */
  score: { bpm: number; notes: [number, number][] }
  /** For a two-voice guide: the lower voice, as its throat was given it, and the body that hummed it. */
  lower?: { take: SessionTake; body: 'male' | 'female' | 'child' }
  /**
   * For a two-voice guide: its chords, explicit, in beats from the section's
   * beginning: the scale degree each triad stands on, the lower and upper
   * voices' degrees, and its function. Degrees count from A in the Song's mode.
   */
  chords?: { at: number; beats: number; root: number; bass: number; upper: number; function: 'home' | 'away' | 'tension' }[]
  /** Which of its chords lies furthest from home: the arc's turning point. */
  furthest?: number
  /** How its voices were hummed for the Music: in turns, the lower opening each chord and the upper finishing it. */
  rendering?: 'turns'
  /** For a section whose melody was written over this guide: the share of its standing syllables on a chord tone, and the most syllables in a row it sang on one pitch. */
  melody?: { onChord: number; run: number }
  /**
   * For a two-voice guide: what its chords were chosen by. Roaming along the
   * arc, with its temperature and pull; or known, with where its roots came
   * from (`scientist:45`, `scientist:45:3`, `classic:ii-V-I`) and the roots
   * themselves, degrees of the Song's mode; or a homecoming that found no
   * favourite it could use, and roamed (`unfound`, the critic it looked to).
   */
  progression?: { style: 'roaming' | 'known'; temperature: number; pull: number; from?: string; roots?: number[]; unfound?: string }
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
  /**
   * Where each Tide stood for this iteration (plan "Tides"): the setting it
   * moved to, and its place in its cycle, rising, holding, falling or
   * resting, and how far through that. Missing on Songs from before Tides.
   */
  tides?: { slug: string; value: number; phase: 'rising' | 'holding' | 'falling' | 'resting'; through: number }[]
}

/**
 * What a DJ says in a Song, kept beside its Session (plan "Intro with
 * Rezzy"): only what that DJ says or does there, per part. Not the DJ's
 * voice or movements: they belong to the DJ, the same for every Song.
 */
export type DjDeclaration = {
  dj: string
  song: string
  parts: { intro?: DjIntro }
}

/** What a DJ says in the intro: the words, and how much the DJ was hurried to fit them in. The voice is the DJ's own and is not kept. */
export type DjIntro = {
  /** When the speech begins, in seconds from the intro's beginning. */
  at: number
  /** How long it lasted when it was fitted, in seconds. */
  seconds: number
  speech: {
    text: string
    /** How much faster than the DJ's own pace the words were said, to fit; missing when they were not hurried. */
    squeeze?: number
  }
}

/**
 * A Song's intro: music from nothing into the first verse, played once,
 * before the Song, on its page only when someone comes to it. It lies before
 * the Song's moment 0, so no one on the Radio ever hears it, and everything in
 * the Song stays where it was. An intro is made after its Song has aired, and
 * kept beside the Session (`paths.intro`, an `IntroRecord`) so that the Session,
 * which is never rewritten for it, is untouched. Songs 1172 to 1176 were made
 * with theirs inside the Session, as this type; a Receiver reads either.
 */
export type SessionIntro = {
  /** How long it lasts, before moment 0. */
  seconds: number
  /** Its music, a bed, at `-seconds`, its tail going on into the Song. */
  recording: SessionRecording
}

/** A Song's intro, kept apart from its Session: the Song, and the intro as the Session's own would have it. */
export type IntroRecord = SessionIntro & { song: string }

export type SessionPart = {
  type: string
  at: number
  seconds: number
  /** The part's own tempo, when it differs from the Song's: beats a minute, or null for free time (no beat, no grid). */
  tempo?: number | null
  /** The part's own musical mode, when it differs from the Song's. */
  mode?: string
  /** How the part presents its words (written, spoken, none for wordless motion, silent for stillness). Omitted on classic verse/chorus/bridge. */
  words?: 'written' | 'spoken' | 'none' | 'silent'
  /** The words, a line at a time. A bridge, interlude, or silence has none. */
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
  /** How many whole bars the line grew past its phrase: the number chanted, or a bar of grace. Missing where it did not. */
  grown?: number
  /** The shortest time between two of its syllables' starts, in seconds. Missing on Songs from before it was kept. */
  quickest?: number
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
  /**
   * For a spoken part: the speech its speaker says via Chimera's speaking throat.
   * Never stored as audio in the Archive.
   */
  speech?: SessionSpeech
  /**
   * For a procedural track (`drone`, `pulse`): declarative synth parameters.
   * Never stored as audio in the Archive.
   */
  synth?: SessionSynth
  at: number
  /** How loud it is played, 1 being as recorded. */
  gain?: number
  kind: string
  /** Which singer sings it, a place in `singers`: 0 is the lead. Voices only. */
  voice?: number
  /** How long its place in the Song lasts, if the Studio knows: a Receiver arriving later need not fetch it. */
  seconds?: number
  /** Seconds the Recording takes to rise from silence at its start, if it fades in. */
  fadeIn?: number
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

/** Whether a Recording is synthesized locally (sung take, spoken speech, or procedural synth) rather than fetched from Archive audio. */
export const isSynthesized = (recording: Pick<SessionRecording, 'take' | 'speech' | 'synth'>): boolean =>
  Boolean(recording.take || recording.speech || recording.synth)

/** What the Archive holds: the Songs it has, oldest first. */
export type ArchiveIndex = {
  songs: string[]
}

/**
 * The slug a name makes, and nothing else: its letters and digits, with the
 * marks that are not letters, digits or hyphens removed, an apostrophe gone
 * without a space, lowercased, and its spaces made single hyphens. One
 * function makes every slug, so a name's link is made the same way always:
 * `Death-machine, the Song's 2nd birth?` is `death-machine-the-songs-2nd-birth`.
 */
export const slugOf = (name: string): string =>
  name
    .normalize('NFC')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\p{Z}\-]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ /g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

/** A Song's link, when it has a name: its number, and the slug its name makes. */
export const linkOf = (session: Pick<Session, 'song' | 'name'>): { song: string; slug: string } | undefined =>
  session.name ? { song: session.song, slug: slugOf(session.name) } : undefined

/** Where things are, inside an Archive. */
export const paths = {
  index: 'index.json',
  session: (song: string) => `sessions/${song}.json`,
  /** What a DJ says or does in a Song, beside its Session: `dj-rezzy-123.json`. Songs from before the DJs have none. */
  dj: (name: string, song: string) => `sessions/dj-${name}-${song}.json`,
  /** A Song's intro, made after the Song aired, beside its Session: `intro-123.json`. Songs from before intros have none. */
  intro: (song: string) => `sessions/intro-${song}.json`,
  /** Where the intros are kept, to list which Songs have one. */
  introShelf: 'sessions/intro-',
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
  /** The names worn: each slug a name makes, and the Song that wears it. */
  names: 'names.json',
  /**
   * The Archive's version: one stamp for the whole of it, changed whenever
   * something already in it is put in afresh, so a Receiver knows that what
   * it holds of it may be old. A new Song does not change it: it only comes.
   */
  version: 'version.json',
}
