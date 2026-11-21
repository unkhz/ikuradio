---
owner: scientist
date: 2026-11-21
state: active
id: 20
kind: plan
slug: evloution-of-song
---

# Evolution of Song

The automaton writes beautiful melodies, but it keeps playing the same song over and over. This is not unlike many other song writers, but there's a possibility of evolution.

A new package, composer, will aid the scientist to craft new ways of varying the songs.

Composer

- lives in the same machine as the studio
- provides a UI for the scientist
- initially has only the current default Arrangement of song parts as the first Arrangement
- allows creating and editing alternate Arrangements
- allows playing a test version of the Song, with the currently edited Arrangement applied
- allows saving the Arrangement as a downloadable file

Arrangement

- is a JSON declaration verifiable by a JSON schema that maps to TypeScript types, built with sinclair/typebox
- allows defining parameter ranges for Facets
- allows defining new kinds of Parts
- allows defining parameter ranges for Parts

Pre-composer world has

- Parts: Intro, Verse, Chorus, Bridge
- Arrangements: ?
  - (robot) One, hard-coded: `arrange()` in `packages/song`, made from the five fields of the `Lyrics` type. Verse 1, chorus, verse 2, chorus, verse 3, and a "final chorus" typed as a verse, with a bridge inserted wherever the kind changes: `v1 b c b v2 b c b v3 v4`, ten sections, the ten parts every Session records.
  - (robot) The Intro is not among them: it is made after the Song has aired, by its own run, and sits before moment 0.

## The architecture (robot, 2026-11-21)

Written with the scientist, in the conversation that followed the draft above.

### What binds the parts today

The Song is two things bound into one: the structure (which parts, in what order) and the words written to it. The `Lyrics` type is both. The Studio asks the Song for its arrangement and walks it to make the music, so a lyrics type decides the shape of the melody, the harmony, the beds and the record. The words themselves depend on nothing but the tune's phrases (how many syllables a line may carry), never on the order of the parts.

The difference between a verse, a chorus and a bridge is spread through the system, in some seventy places in twenty-four files:

| Concern | Where | What a part's kind decides |
|---|---|---|
| Words | song | verse: written from a memory, from the previous iteration's same place; chorus: line 1 is the song's age, line 2 rhymes with it, the rest lightly varied; bridge: none |
| Melody | melody | the phrases it sings (`tune.verse` or `tune.chorus`); the chorus's reciting note, on which the number is chanted for as long as it takes; a bridge's journey from the part before it to the part after it |
| Harmony | studio/progression, perspectives | a progression per kind; the homecoming and settled-chorus Perspectives |
| Cadence | studio/guide, perform | a chorus, or the last part, comes home (`full`); the others end open on the fifth (`half`) |
| Measure | studio/compose, tides | each line's syllables, from the kind's phrase; wordiness and ceiling Tides per kind |
| Guide and beds | studio/guide, music | a bridge is sixteen beats; hummed, or in an atonal row; its beds told their own band; bed kinds `bridge:verse>chorus` |
| Voices | perspectives | `bridge-singers`, `bridge-voice`, `verse-tune`, the choir on the verses |
| Record and show | archive, radio, ui | `SessionPart.type` is `'verse' \| 'chorus' \| 'bridge'`; the Radio's favourites; the page's bridge |

### Parts are data, kept in git

There is no `type Part = 'verse' | 'chorus' | 'bridge'` any more. The parts are modules, and the modules are the input the types and the schemas are made from.

- A new package, **parts**, holds one folder a part, as the Tides and the Perspectives do: `packages/parts/verse/`, `chorus/`, `bridge/`, each with its record and its module. The package finds them by reading its folders. Adding a part is adding a folder.
- Every part is a subclass of one superclass, **Part**, and every part is fully interchangeable: whatever takes a Part takes any of them.
- Every part may sing. Singing needs melody and pronouncing, so every part depends on what singing needs (`melody`, and the throat's pronouncing in `vocals`). Humming is singing with the words and the pronouncing left out: a part that hums still has the same dependencies, and does not use them.
- A part declares its simple parameters as **scalar values**, and the parts of it that vary, by the moment or by logic, as **functions** that return values.

A first sketch of the superclass, from what the kinds differ in today:

```ts
abstract class Part {
  /** Its name, the folder's: never reused, never removed once a Song has been made with it. */
  abstract readonly id: string
  /** Whether it has words: written by the mind, or none (hummed, or silent). */
  readonly words: 'written' | 'none'
  /** How it ends, unless its place says otherwise: home, or open on the fifth. */
  readonly ending: 'full' | 'half'
  /** A fixed length in beats (a bridge: 16); without it, as long as its lines. */
  readonly beats?: number
  /** Its parameters and their ranges, as a TypeBox schema: wordiness, ceiling, span, travel... */
  abstract readonly parameters: TSchema

  /** THE interchangeable contract: how many syllables line `index` should carry and may carry, and whether it may grow past its bars. */
  abstract measure(line: LineContext): LineMeasure
  /** The phrases its lines are sung to, from the Song's tune. */
  abstract phrases(tune: Tune, place: Place): Phrase[]
  /** A line that is not the mind's to write, if any (the chorus's first: the song's age). */
  fixedLine?(index: number, place: Place): string | undefined
  /** What the mind is asked, for a part with words. */
  instruction?(place: Place): string
}
```

The one contract every part must keep is **measure**: how many syllables each line is meant to have and may have, and how long it may be. Most parts take it from their phrase and their wordiness. The chorus overrides it for its first line: that line is counted from its phrase exactly, never touched by wordiness, and grows on its reciting note, a bar at a time, with no ceiling, because the song's age has more syllables every year.

The chorus is the part with the most logic of its own. The counting is the chorus's code. If another part ever needs it, it imports the shared logic into its own function; it does not become a property of the superclass.

### Arrangements

An **Arrangement** chooses parts, places them, and gives them their parameters. It is a JSON declaration, checked by a TypeBox schema that is made from the parts found in `packages/parts`, so a declaration naming a part that does not exist, or a parameter outside its part's range, is refused before anything is made.

- It lists every **instance**, in order, bridges included. Today's Song is the first Arrangement, written out: ten instances, `v1 b c b v2 b c b v3 v4`. Nothing is inserted by a rule; an Arrangement without bridges simply has none, and its parts meet.
- An instance has a **name** of its own (`verse-1`, `chorus`), which is its identity. Instances with the same name sing the same words: the chorus is one instance heard twice. An instance continues the instance of the same name in the iteration before; a name not heard before begins from its part's first words.
- An instance may set its part's parameters, within the part's ranges.
- A place says what a part's function may need: its neighbours (a bridge's journey runs from the part before it to the part after it), whether it is last (the last part comes home), the iteration.
- Parameter ranges for the Facets come after the parts: how an Arrangement narrows what the Perspectives and the Tides may do is decided when the parts are in place.

### The Archive's schema evolves by addition

The Archive is forever, and its schema can still grow: addition is backwards compatible.

- `verse`, `chorus` and `bridge` can never be removed. A test in `packages/parts` fails if any of them is missing.
- More parts can be added without breaking anything, once the readers are open: the `'verse' | 'chorus' | 'bridge'` unions in the archive, music, melody and studio, the Radio's favourites and the page's bridge must take an id they have never heard of. A Session records, beside a part's id, what a reader needs to show it (whether it has words), so a page can show a part that was added after the page was written.
- The Session's `version` is never raised for this: the Radio plays only Sessions of its own version, and a raised version would silence every Song made before it.

### Packages, and which way they lean

- **parts** sits above `melody`, `vocals` and the words of `song`, and imports what it needs from them. They become its libraries; none of them imports parts.
- **composer** depends on parts. It needs no mind and no music: it runs anywhere, on the Mac or on xitra. It is the scientist's place to see and change the parts and the Arrangements.
- The Studio, the Receiver and the Radio move to the new world only when parts and composer are excellent. Until then nothing in the running song changes.

### How the work is done

- The **work loop** (the session "Ikuradio work loop") builds this plan, one step at a time, in its usual way: commits, tests, pushes through arkku, thoughts.
- The **Composer session** (`local_fc37e40e-0716-4eb8-8cf6-bb6cf79eca3d`) reviews it. After every push that belongs to this plan, the loop sends that session one message: the step, the commit range, and anything it was unsure of. Its review comes back as a message; the loop takes it up in its next round, before going on.
- The Composer session only reviews and refines the plan. It never edits the files the loop is building, so nothing is written twice.
- A step is done when its proof passes (each step says what that is) and its review has nothing left to change. Then the next step begins.
- Nothing in the running song changes in steps 1 to 4: no Studio, Radio, Receiver or Archive code is touched, except where a step says so.

### Steps

1. **parts**: the Part superclass; `verse`, `chorus` and `bridge` declaring today's behaviour as scalars and functions; the registry that finds them; the schemas made from them; the test that the three can never go. The proof is equivalence: at the first tune and the usual Settings, every line's `measure` is what `fittingFor` gives today, the chorus's first line included.
2. **The first Arrangement**: the Arrangement schema, and the Song as it always was, written out as a JSON declaration. The proof: it gives exactly what `arrange()` gives, the same ten parts in the same order, with the same sharing and the same cadences.
3. **composer, to look**: a page that shows every part, its parameters and their ranges, and an Arrangement drawn as a diagram: its instances in order, along the bars at a tempo, the shared words, where the bridges run from and to, where each part comes home.
4. **composer, to change**: making and editing Arrangements, parameters within their ranges, the schema's refusals said plainly, and saving an Arrangement as a file to download.
5. **Later, each a plan of its own**: opening the readers to new ids; the Studio made with parts and the first Arrangement, Song for Song identical to what it makes now; the Intro; and playing a test version of a Song in the composer, which needs the mind and the band and so the Heart's slack.

### Step 1 in detail: the parts package

What to build, and nothing more:

- `packages/parts/`, a workspace package like the others (`package.json`, `tsconfig.json`, added to the root `lint` list).
- `packages/parts/lib/part.ts`: the abstract `Part` class and its types (`LineContext`, `LineMeasure`, `Place`). Start from the sketch above; change it where building shows it is wrong, and say why in the commit.
- `packages/parts/verse/`, `chorus/`, `bridge/`: each a `part.ts` whose default export is an instance of its subclass, and a short `part.md` saying what the part is, in the voice of the other records (`packages/tides/verse-ceiling/tide.md` is a good model).
- `packages/parts/lib/registry.ts`: finds the parts by reading the package's folders, as `packages/tides/lib/tides.ts` does, and returns them by id. No list of ids written anywhere in code.
- `packages/parts/lib/schema.ts`: the part ids, and each part's parameters, as TypeBox schemas made from what the registry found. Add `@sinclair/typebox` with an exact version.
- `packages/parts/index.ts`: exports the class, the registry and the schemas.

What the three parts declare, from the code as it is today:

- `verse`: words written; ends half; its lines' phrases are `tune.verse`; its parameter `wordiness` (0 to 1, usually 0.5) and its melody `ceiling`, `span`, `travel` (ranges as the Tides use them).
- `chorus`: words written; ends full; its phrases are `tune.chorus`; the same parameters; and its first line is the song's age (`chorusOpening` in `packages/song`), measured from its phrase exactly, never touched by wordiness, growing on its reciting note (`chorusHook[0].reciting` in `packages/melody`).
- `bridge`: no words; ends half; 16 beats (`bridgeBeats` in `packages/melody`); its melody runs from the part before it to the part after it.

`measure` returns, for a line, `{ target, most }` syllables and whether it may grow past its bars. For now it is the counting only: `target` is the phrase's note count, `most` is `mostSyllables(phrase, spacing(tempo, rate))`, and wordiness moves them as `wordyCount` does. The check that a written line truly fits (`fittingFor`'s `check`) needs the throat and `stressedLine`, which lives in `packages/studio`; parts must not import the Studio, so that check moves in a later step, when the Studio moves.

Import from `melody`, `song` and `vocals` freely; nothing in them may import `parts`. If a function you need is not exported, export it; do not copy it.

The proof, as tests in `packages/parts`:

- **Equivalence**: for `firstTune`, the usual Settings (`defaults(1)` in `packages/perspectives`) and a few tempos (60, 72, 94, 120 bpm) at the usual rate (6 syllables a second, `SYLLABLES_PER_SECOND`), every line's `measure` for `verse` and `chorus` equals what `fittingFor(...)` in `packages/studio/lib/compose.ts` gives for that part and line, the chorus's first line included. Do it also at wordiness 0.2 and 0.9. (`fittingFor` may be imported in the test only.)
- **The Archive's ids**: a test fails if `verse`, `chorus` or `bridge` is not found.
- **Interchangeable**: one test takes every part the registry finds and calls everything the superclass promises, without knowing which part it has.
- **No closed union**: `packages/parts` has no `'verse' | 'chorus' | 'bridge'` type anywhere.
- `bun run lint` and `bun run test` pass.

Then message the Composer session for review.

### Still open

- **The Intro as a part.** It could be a part whose making waits for its Song to have aired, played or not by what triggers it. It is decided when the other parts are written out and it can be seen whether anything in the intro cannot be a parameter.
- **Facets in an Arrangement.** How an Arrangement's ranges for Facets meet the Perspectives and the Tides.
