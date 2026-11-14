---
date: 2026-11-14
state: active
owner: scientist
id: 7
kind: plan
slug: a-melody-for-every-iteration
---
# A melody for every iteration

Time follows lyrics now, and the words are no longer swallowed. The number line has become a mini-song of its own, which is what we want. But its extension is a stretched candy: `growOnReciting` adds whole bars to one note, and the bar fit splits that note into a row of syllables on one pitch.

The deeper problem is that the song always sings the same melody: fixed hooks, with the verses stepping once per Song. That is the easy way to sound familiar, and it costs the music its credibility.

**From now on, the lyrics and their rhythm drive the melody.** There are no fixed melodies, no templates of progression and no line roles. Every line gets new pitches every iteration, chosen by a sprinkle of randomness inside the rules of harmony. This is a hard problem, so the first version is simple, and then we iterate by ear until it works.

## What the melody writer reads

1. **The timed lyrics**, one entry per sung syllable, as the bar fit lays them out:
   - the syllable and its word
   - its stress
   - its onset and length in beats
   - its place in the bar
   - whether a comma or the line's end follows
   - for the number line, its number group

   `fitBars` computes all of this already; it only needs to be handed on.
2. **The Mood's mode and tempo, and the voice's range** (`reach.ts`).
3. **The guide:** the same line as it was sung last iteration, if there was one. It is a gentle pull for continuity, not a template.

## How the rhythm drives the pitches

The rhythm of the words is where the interest comes from. The writer reads it like this:

- **Stressed syllables on strong beats** are where the melody stands: chord tones, and where it may leap to.
- **Long notes** are where the melody arrives: chord tones, often a step or a leap away from the note before.
- **Runs of quick, unstressed syllables** move by step, as passing and neighbour notes between the standing points.
- **A comma or the line's end** is a breath: the melody settles there onto a stable chord tone.
- **The line's high point** goes on its most stressed content word, wherever that falls. It never goes on "the", "and" or "of".
- **The number line:** each number group ends on its scale word ("thousand", "million") as a small arrival. The groups may echo one another's shape, because the words repeat their shape, not because a rule says so.

## Harmony: chords under the words

- **Chords change where the words lean:** on stressed syllables, long notes and word starts that fall on beats 1 or 3. Each line's pattern of chord lengths comes out of its own rhythm.
- **Sensible limits only:**
  - A chord lasts from one beat (at least 0.6 s) to two bars (at most 6 s).
  - A line or a comma ends on a chord that can rest.
- **Chords are the diatonic triads of the Mood's mode.** Common moves (by a fourth or fifth, by step, to the relative chord) are a little more likely. There is no progression template.
- The chords are stored with the line and handed to the choir's harmonizer through its existing `ChordSource` hook, so the choir sings within the same harmony.

## The rules of melody, and the sprinkle

Rules, as costs:

- chord tones on standing points
- steps are cheap, leaps dear, and after a leap the melody turns back
- more than three syllables in a row on one pitch costs more with each repeat (the end of the solid line)
- stay in the voice's range
- leave the guide's contour a little reluctantly

**The sprinkle:** instead of always taking the cheapest melody, the writer **samples** among good ones. Cheaper melodies are more likely, so the randomness lives inside the rules. The sampling is seeded by the line's wrongness (`melody:<iteration>:<part>:<line>`), so the same iteration always writes the same melody and can be made again from the diary. The same words in the same iteration are sung the same, so both choruses of an iteration match.

## Settings: the knobs we iterate with

These are set in `tools/lib/env.ts`, recorded with each Song, and tuned by ear:

- `MELODY_SPRINKLE`, default 1: how adventurous the sampling is. 0 always takes the cheapest melody; higher roams.
- `MELODY_GUIDE`, default 1: how strongly last iteration's line pulls.

The costs themselves live in one table in `melody/lib/writer.ts`, so a tweak is one number.

## Later, once it sings: convergence

When the lines sound good, add each line's fading **memory**: how often each degree, contour and chord has sounded at each moment of the line, with a half-life (a longer one for the chorus). Its pull makes the song converge towards something familiar without any note being fixed. It waits until we have heard the writer on its own, so we know what we are converging to.

## Recorded per line

- the written melody and its chords: the next iteration's guide, and later the memory
- the longest one-pitch run, in seconds
- the share of stressed strong-beat syllables on chord tones
- the sprinkle and guide settings used

## What moves

- **`melody/lib/fit.ts`**: `fitBars` returns the timed syllables; `growOnReciting` still grows the time, and the writer fills it with pitches.
- **`melody/lib/writer.ts`**: becomes the writer for every line, sampling instead of taking the cheapest.
- **`melody/lib/chords.ts`** (new): chords from the lyric rhythm.
- **`melody/lib/harmony.ts`**: chords plugged into `ChordSource`.
- **`melody/lib/hooks.ts`, `variation.ts`**: the hooks are only the guide for iteration 1; the per-Song `evolve` step is retired.
- **`song`**: the number's groups handed on with the syllables.
- **`studio`**: passes last iteration's lines in as guides, and stores what was written.
- **The guide hum and the Music** follow the lead as written, so the beds follow the new melody without change.

## Order of work

1. Hand on the timed syllables, and write every line with the writer. The number line comes first, then the whole chorus and the verses. Retire the fixed melodies.
2. Chords from the lyric rhythm, and the choir hearing them.
3. Listen. Tune the knobs and the cost table, and repeat. Every round is a commit the scientist can hear on the Radio.
4. When the lines sing well: the memory, for convergence.
