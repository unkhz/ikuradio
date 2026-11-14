---
date: 2026-11-14
state: draft
owner: scientist
id: 9
kind: plan
slug: progressions
---
# Progressions, roaming and coming home

The two-voice guide found the secret sauce: the harmony leaves home, finds the counterpoint and comes back, and the music feels alive. Every Song now roams the same way. Some Songs should roam freely, as now. Others should keep closer to a progression we already know is good: one of our own favourite moments, sung again under new words.

**Harmony becomes a Perspective Facet, `progression`, turned per part.** The words still decide where chords change (time follows lyrics). The Facet decides which chords those are.

## Where it hooks

`composeGuide` (`melody/lib/guide.ts`, called per section from `studio/lib/guide.ts`) splits its work in two:

- `changePoints` decides **where** the chords change, from the words. It is untouched.
- `chordPath` decides **which** chords. Today it samples along the arc, with `arc`, `temperature` and `guidePull` from `guideCosts`, and a fixed cadence.

The Facet's hook goes where `chordPath` is called. That hook knows which part the section is, so the Setting is kept per part.

## The Setting

```ts
progression: {
  verse:  Progression
  chorus: Progression
  bridge: Progression
}

type Progression = {
  /** Sampled along the arc, as now; or the chords of a known progression, laid over the words' change points. */
  style: 'roaming' | 'known'
  /** For 'known': the chord roots as scale degrees of the Song's mode, and where they came from. */
  known?: { roots: number[]; from: string }
  /** How adventurous the sampling is (`guideCosts.temperature` today). */
  temperature: number
  /** How strongly last iteration's chords pull (`guideCosts.guidePull` today). */
  pull: number
}
```

The default is today's behaviour for every part: `roaming`, with temperature 0.7 and pull 0.4. A Turn changes only the part it's about.

## A known progression over new words

- **Fitted by place, not by count.** The known roots are laid over the new change points by relative position in the section (the same mapping `chordPath`'s pull already uses). A favourite with 6 chords still works over a section with 9 change points or 4.
- **Rules every part keeps:**
  - **Departure:** a section begins on the chord the previous section ended on. If the known progression starts elsewhere, its first chord gives way.
  - **Cadence:** the section still ends as its part asks: V into what follows, or V–I at the end of a chorus or iteration. The known chords fill the rest.
  - **Bridge arrival:** a bridge must arrive at the next part's opening chord. A known progression gives a bridge its middle; the arrival stays.
- **In any mode.** Roots are scale degrees, so a favourite from a dorian Song sung in an aeolian one keeps its shape and takes on the new mode's colours.
- **The counterpoint is unchanged.** Both voices are still written over the roots by the same rules, and so are the melody, the choir and the beds.

## The scientist's favourites

The homecoming is a list of known good moments from the song itself, kept at `critic/scientist.json`:

```json
{
  "favorites": {
    "chorus": [1],
    "bridge": [1],
    "verse": [1]
  }
}
```

- **The file is a critic's.** `critic/` is where the music critic concept will live; this file is its first piece: one critic's (the scientist's) favourites, written by hand. Other critics may be added beside it later with the same shape. The Studio only reads it. Nothing generated goes into `critic/`.
- **What a number means: a Song.** A favourite under `chorus` is that Song's chorus, found in its Session. Its sections of that part are taken **by place**, in the order its first iteration's `parts` list them: a homecoming verse 1 sings the favourite's first verse, verse 2 its second, and so on. When the favourite has fewer sections of that part than the new Song, its last one is used again.
- **A precise favourite, when wanted:** `"45:3"` means Song 45's third verse (counted within its first iteration), sung in every verse. Plain numbers and precise strings can be mixed in one list.
- **Where the chords come from: whatever the data holds, best first.** Nothing depends on which Song it is, only on what its Session contains:
  1. **The guide for that section has `chords`:** they are taken as they are.
  2. **It has only a `score`** (a one-voice hum): its notes are harmonized when the favourite is used, a triad per span covering its strong notes, by the same costs as the guide. This is deterministic and cheap, so nothing is stored; the Studio may keep the result in memory while it runs. Song 1's chorus is like this, and gives back the chords the original hook implies.
  3. **There is no guide for that section** (some Sessions kept one only for the first section of each part): the nearest guide of the same part in the same iteration is used, then any guide of that part in the Session.
  4. **There is no guide of that part at all, or no Session, or it can't be read or parsed:** the favourite is skipped, with a warning in the log.
- **Choosing.** Each homecoming Song picks one favourite for its part by the Song's wrongness. The choice, and the roots it took, are written into the Session (`progression.from`, for example `"scientist:45"`), so the Song can be made again even after the file changes.
- **When a favourite is skipped,** the next one is tried. With none left, the part roams as usual, and the Session says so.

## The Perspectives

Each is a record and an `actions.ts` in `packages/perspectives`, as usual. The homecoming weights are 10 for now, to test them; the scientist sets the weights by hand later:

| Perspective | Turns | Weight |
|---|---|---|
| `progression-chorus-homecoming` | The chorus sings a favourite chorus's chords; the verses and bridges roam. | 10 |
| `progression-verse-homecoming` | The verses sing a favourite verse's chords. | 10 |
| `progression-bridge-homecoming` | The bridges sing a favourite bridge's chords between their departure and arrival. | 10 |
| `progression-settled-chorus` | The chorus roams with temperature 0.3 and pull 1.2: it barely moves within the Song. | 4 |
| `progression-walking-verses` | The verses walk a classic progression, chosen as a variant: i–VII–VI–V, i–VI–III–VII, ii–V–I, or round the circle of fifths. | 1 |

Perspectives on different parts may be chosen together, so a Song can have a homecoming chorus over walking verses. Two on the same part never are.

## Later: the melody comes home too

The same favourites can guide the melody writer: a `melody` Facet, also per part, that makes the favourite's sung lead line the guide, with a strong pull. A homecoming chorus would then sound close to the favourite in melody as well as chords, while still fitting its new words. That waits until the chords' homecoming has been heard.

## Cleanup

The `verse-tune` Facet and its `verse-unfamiliar-melody` Perspective date from when the verse tune was fixed. Every line is written anew each iteration now, so it likely does nothing: check, and retire it if so.

## Recorded per section

- the part's progression Setting: `roaming` or `known`, with its temperature and pull
- for `known`: where its roots came from (`scientist:45`, `scientist:45:3`, `classic:i-VII-VI-V`) and the roots themselves

## What moves

- **`perspectives/lib/facets.ts`**: the `progression` Facet, its per-part Setting and defaults; `.arkku/templates/perspective.ts` kept in step.
- **`melody/lib/guide.ts`**: `chordPath` takes the per-part Setting: temperature, pull, and known roots laid by place, with the departure, cadence and arrival kept.
- **`studio/lib/guide.ts`**: passes each section's part Setting in, and records what it used.
- **`studio`** (new, small): reads `critic/scientist.json`, finds each favourite's chords in the Archive, and harmonizes old guides on the fly.
- **`packages/perspectives`**: the five Perspectives above.
- **`archive/lib/session.ts`**: `progression` on each guide.

## Order of work

1. The Facet, with the default reproducing today's guides exactly. A test checks that a Song made with the defaults gets the same chords as before.
2. Known roots laid over change points, with the departure, cadence and arrival kept. Tests cover a long favourite over a short section and the reverse.
3. Reading `critic/scientist.json`, and finding each favourite's chords by the fallbacks above. Tests cover a Session with chords, one with only a score, one missing a section's guide, and one with no usable guide. Check Song 1's chorus against the original hook by ear.
4. The Perspectives. Rehearse a chorus coming home to Song 1, and listen.
5. Retire `verse-tune` if it does nothing.
