---
date: 2026-11-14
state: active
owner: scientist
id: 8
kind: plan
slug: two-voice-guide
---
# The two-voice guide

Today the guide hum comes last. The lines are sung first, and then the lead hums their skeleton, one voice, for the Music to follow. The melody is decided before the harmony, and MusicGen is left to guess the chords from a single slow line. It wanders, because nothing tells it where home is.

**From now on, the guide comes first.** Each section's guide is a **two-voice hum**: an upper voice and a lower voice in counterpoint. It is written from the timed lyrics, before any melody, as a harmonic progression that **leaves home, finds the counterpoint, and comes back**. It is then the one source of harmony for everything after it:

- **the melody writer**, which writes each line to satisfy the guide's intervals
- **every MusicGen bed**: verses, chorus and bridges
- **the choir's harmonizer**, through its `ChordSource` hook

## The order of making an iteration

1. Lyrics
2. The bar fit (time follows lyrics): every syllable's onset, length and stress. This sets each line's and each section's length.
3. **The two-voice guide**, for every section: verses, chorus and bridges.
4. The melody writer, over the guide.
5. The harmonizer, the singing, and the beds grown from the guides.

## Dividing the time into a progression

The guide's length is the section's length, from the bar fit. A bridge keeps its own length. The guide divides that time by the words:

- **Phrase points.** Line ends and commas are where the harmony breathes. A line end is a cadence point; a comma may be a lighter one.
- **Chord changes** fall where the words lean: on stressed syllables, long notes and word starts on beats 1 or 3. A chord lasts from one beat (at least 0.6 s) to two bars (at most 6 s).
- **The number line** divides by its number groups. Each group is a harmonic step, and its scale word ("thousand", "million") lands on a chord change.
- **No guide note is shorter than 0.5 s.** MusicGen's chroma window is 512 ms, so anything quicker is smeared into its neighbours.

## The arc: leave, find the counterpoint, return

A guide is not a wander. Each section has a tonal arc:

- **It departs from home:** the tonic, or, when the section follows another, the chord the previous section ended on.
- **It travels away** through the Mood's mode. The furthest point, in tension, falls in the latter half of the section, often at its last phrase point before the end.
- **It returns** with a cadence:
  - A section that ends a part, or leads into a different part, ends with a half cadence on V. The next section's departure resolves it.
  - The end of a chorus, and the end of an iteration, come fully home with V–I.
  - A bridge leaves the part before it and arrives at the next part's opening chord. This replaces `journey`'s single walking line with a two-voice one.
- **The path is chosen with the sprinkle.** Several good paths fit the arc. They are sampled, seeded by the section's wrongness (`guide:<iteration>:<part>:<section>`), so the same iteration always gets the same guide. Last iteration's guide for the same section pulls gently, for continuity, so the harmony drifts from one iteration to the next instead of jumping.

## The two voices

- **The lower voice** is the harmony's foundation: roots and inversions, moving like a bass line. It is mostly steps and fourths and fifths, with leaps turned back.
- **The upper voice** is a slow melody over it: one or two notes per chord, mostly by step. It is the target the sung melody will circle.
- **Counterpoint between them:**
  - On chord changes and strong beats they form consonances: thirds, sixths and tenths most of all, with fifths and octaves at the start and the cadences.
  - Contrary and oblique motion are preferred.
  - No parallel fifths or octaves.
  - At a cadence they close in by step: the upper voice 2→1 or 7→1, the lower 5→1.
- **Each chord is stored explicitly** with the guide: its root, the bass degree, the upper degree, its beats and its function (home, away or tension). Nothing has to guess the chord from the audio.
- **Who hums:** the lead hums the upper voice. The choir's lowest body, or the male throat when the choir has none, hums the lower voice. Both stay within their reach (`reach.ts`).
- **Atonal bridges** (the `bridge-beds` Perspective) keep their row: the upper voice hums the row, and the lower voice its inversion, in the same rhythm. They stay in tempo and keep no key.

## For the melody writer

The guide replaces the chords the melody plan meant to derive itself:

- **Standing points** (stressed syllables on strong beats, long notes) prefer the guide's chord tones, and most of all the upper voice's note at that moment, or a third or sixth from it.
- **The sung line forms good counterpoint with the lower voice:** no parallel fifths or octaves against it, and arrival onto consonances.
- **Cadences:** the line closes where the guide closes, onto the guide's cadence notes.
- Everything else in "A melody for every iteration" stands: the lyrics' rhythm drives the line, and the sprinkle samples among good melodies. The guide gives it somewhere to go.

## For MusicGen: what it can actually hear

MusicGen-melody hears its input as chroma. Each 128 ms frame looks at a 512 ms window, and only the single loudest pitch class in that frame is kept. This is the `argmax` in transformers' `MusicgenMelodyFeatureExtractor`. So **two voices hummed together reach MusicGen as one line**, whichever is louder from frame to frame. The second voice helps only where it wins a frame.

So how the guide is rendered for MusicGen is a measurement, made before choosing:

1. **Render variants** of the same guides, for about ten sections:
   - (a) the upper voice alone, as today
   - (b) both voices at equal level
   - (c) the lower voice louder
   - (d) **the voices taking turns**: the lower voice leads for the first half-second or more of each chord, then the upper voice leads. This is a compound melody, as in a solo cello suite: one line that implies two voices and spells the chord over time.
   - (e) (d) with both voices always sounding, only the balance turning
2. **Run the feature extractor itself** on each render (CPU on xitra, no GPU, no model), and measure per chord span:
   - the share of frames whose pitch class is a chord tone
   - whether the root is seen at all
   - the share of frames that follow the upper voice
3. **Grow beds** from the two best variants, for the same sections, and the scientist listens to them side by side.
4. **Choose** by the numbers and the ear, and write the reason beside the rendering code.

The guide's score, with both voices and explicit chords, is kept in the Session whatever the rendering, as today's guide is.

## Beds

- **Every bed grows from its section's two-voice guide**: verses, chorus and bridges, as MusicGen always must (see "MusicGen needs the guide").
- The shelf reuses a bed only when the guide is the same. A new guide grows a new bed.
- The prompt still names the instruments. The guide alone carries the harmony, the rhythm and the phrasing.

## Recorded per section

- the guide's two voices, its chords and their functions, and the arc's furthest point
- the rendering variant MusicGen heard
- from the extractor: the share of frames on chord tones, as heard by MusicGen

## What moves

- **`melody/lib/guide.ts`**: becomes the two-voice composer: the arc, the counterpoint and the chords. `slowSection` is retired.
- **`melody/lib/bridge.ts`**: bridges become two-voice guides from part to part.
- **`studio/lib/guide.ts`**: the guide is composed before the melody and hummed in two throats, then rendered for MusicGen as measured.
- **`studio/lib/compose.ts` and `perform.ts`**: the new order: fit, guide, melody, sing.
- **`melody/lib/writer.ts` and `harmony.ts`**: read the guide's chords and voices.
- **`music/accompany.py`**: unchanged. It hears whatever audio it is given.
- **Plan "A melody for every iteration"**: its own `chords.ts` is replaced by the guide's chords. The rest stands, and it is built on top of this plan.

## Order of work

1. **Compose the two-voice guide** (the arc, the counterpoint, explicit chords) from the timed lyrics, for verses, chorus and bridges. Unit tests check consonance on chord changes, no parallel fifths or octaves, and a cadence at every section's end.
2. **The MusicGen measurement**: the variants, the extractor numbers, the side-by-side beds, the choice.
3. **Beds grow from the chosen rendering**, for every section kind. Listen on the Radio.
4. **The melody writer** reads the guide, continuing "A melody for every iteration" with the guide in place of its own chords.
5. **The choir hears the guide's chords** through `ChordSource`.
