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

(The timeline below, written 2026-11-23, grows this: the instances become the regions of a timeline, and the Arrangement also places Tracks and Blocks on it.)

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
5. **composer, the map**: a front page that draws the Song's concepts and how they lead into one another, each a link to a page of its own. The parts and Arrangement pages built so far move behind it.
6. **composer, the pages of what shapes a Song**: the Mood, the Perspectives and their Facets, and the Tides, each illustrated: its variables, their ranges, and how it moves. Nothing is editable yet.
7. **composer, the pages of what a Song makes**: the Tune, the Lyrics, the Score, the Beds and the Song itself, each illustrated from the first tune and sample values, with no mind and no music.
8. **The timeline**: Tracks, Blocks, anchors and the tempo map in `packages/parts`, the Arrangement grown to hold them, and the resolving of a timeline into beats and seconds.
9. **The Song as a timeline**: `the-song` written out as one, two passes, giving what the Studio lays out today; and a second Arrangement that changes tempo and has a bridge in free time.
10. **composer, the timeline to look at**: the Arrangement drawn as a DAW draws a session: the regions on the ruler, the tempo, the Tracks as rows, the Blocks coloured by what they are, overlapping and fading.
11. **composer, the timeline to change**: placing, stretching, keying and fading Blocks, and the tempo map, checked as Arrangements are.
12. **composer, two modes**: a Learn | Edit toggle at the top right. Learn explains as the pages do now; Edit is a workspace per concept, with one shell for picking, undoing and checking. The Arrangement's editor moves into Edit.
13. **composer, the Arrangement's hands**: Blocks, regions, tempo points and turns dragged, stretched, drawn and copied on the timeline, snapping to anchors and bars.
14. **composer, the Parts, the Perspectives and the Tides in Edit**: parameters as sliders with each line's measure redrawn; Facets and tide envelopes edited, checked and saved as files.
15. **composer, the benches**: the Mood, the Tune, the Lyrics, the Score, the Beds and the Song tried by hand, nothing saved.
16. **Later, each a plan of its own**: opening the readers to new ids; the Studio made with parts and the Arrangements' timelines, making each distinct Block once and mixing the timeline, Song for Song identical to what it makes now for `the-song`; the Studio made with parts and the first Arrangement, Song for Song identical to what it makes now; the Intro; and playing a test version of a Song in the composer, which needs the mind and the band and so the Heart's slack.

### Step 1 in detail: the parts package

What to build, and nothing more:

- `packages/parts/`, a workspace package like the others (`package.json`, `tsconfig.json`, added to the root `lint` list).
- `packages/parts/lib/part.ts`: the abstract `Part` class and its types (`LineContext`, `LineMeasure`, `Place`). Start from the sketch above; change it where building shows it is wrong, and say why in the commit.
- `packages/parts/verse/`, `chorus/`, `bridge/`: each a `part.ts` whose default export is an instance of its subclass, and a short `part.md` saying what the part is, in the voice of the other records (`packages/tides/verse-ceiling/tide.md` is a good model).
- `packages/parts/lib/registry.ts`: finds the parts by reading the package's folders, as `packages/tides/lib/tides.ts` does, and returns them by id. No list of ids written anywhere in code.
- `packages/parts/lib/schema.ts`: the part ids, and each part's parameters, as TypeBox schemas made from what the registry found. Use TypeBox 1.x, the package `typebox` (imports from `typebox` and `typebox/value`), not the 0.x `@sinclair/typebox`, at an exact version (1.4.7 when this was written). The scientist decided this after f1cbfb1, which had used 0.34.41.
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

Built as f1cbfb1. Where building changed the sketch above:

- `words` and `ending` are abstract: every part says them, none inherits them.
- `measure` and `fixedLine` take the line's number as `line`.
- `instruction` is not on the class yet. The verse's instruction is a private constant in `packages/song`, and the chorus's is built inside `pickChorus` from the throat's pronouncing dictionary when the mind is asked. It joins the class when the Studio moves.
- The parameter ranges are kept in `packages/parts/lib/ranges.ts`, since parts sit above the Tides, not beside them. A test holds them equal to the Tides' `validRange` and the usual Settings.

### Step 2 in detail: the first Arrangement

What to build, and nothing more:

- `packages/parts/lib/arrangement.ts`: the Arrangement schema, made from the registry, as the part schemas are. An Arrangement is `{ id, title, instances }`, and an instance is `{ name, part, parameters? }`: `part` is a part id the registry found, and `parameters` is checked by that part's own parameter schema. Export `arrangementSchema(records)`, and `refuseArrangement(value)` that gives the first thing wrong, said plainly, or nothing.
- What the schema alone cannot say is checked beside it, in the same refusal:
  - instances with the same `name` must name the same `part`, since they sing the same words;
  - an Arrangement has at least one instance.
- `packages/parts/arrangements/`: one folder for each Arrangement, as the parts have, each with an `arrangement.json` and an `arrangement.md` saying what it is. The first is `arrangements/the-song/`: today's Song written out, all ten instances in order, bridges included. Nothing is inserted by a rule.
- Its instances, by name: `verse-1`, `bridge-1`, `chorus`, `bridge-2`, `verse-2`, `bridge-3`, `chorus`, `bridge-4`, `verse-3`, `final-chorus`. `final-chorus` is a `verse`, as `Lyrics.finalChorus` is today. The bridges have names of their own, one each, because each runs between different neighbours.
- `placesOf(arrangement, iteration)` in the same file: each instance's `Place` (`before`, `after`, `last`, `iteration`). Add `ending(part, place)`, which gives `'full'` when the place is last and otherwise the part's `ending`. That is how a place says otherwise, as the sketch promised.
- The registry finds the Arrangements by their folders, as it finds the parts. A folder whose `arrangement.json` is refused fails loudly, naming the folder and the refusal.

The proof, as tests in `packages/parts`:

- **Equivalence with `arrange()`**: for any `Lyrics`, `arrange(lyrics)` in `packages/song` gives, part for part, the instance's part id as its `type`. For each instance with words, the Lyrics field whose content `arrange()` puts there is the same field every time that instance's name appears. Write a small map in the test, from instance name to Lyrics field (`verse-1` to `firstVerse` … `final-chorus` to `finalChorus`); the map is the test's, not the package's.
- **The same cadences**: `ending(part, place)` for every instance equals what `perform.ts` says today (`part === 'chorus' || last ? 'full' : 'half'`). Write the rule out in the test; don't import perform.
- **The same journeys**: each bridge's `before` and `after` are the parts `arrange()` puts on either side of it.
- **Refusals**: a part that does not exist, a parameter outside its range, a parameter its part does not have, one name used for two parts, and no instances are each refused, with a message that says which.
- **Interchangeable still**: nothing in `arrangement.ts` names a part id. The no-closed-union test covers the new files.
- `bun run lint` and `bun run test` pass.

Then message the Composer session for review.

Built as 6fac7e9. Where building changed it:

- `refuseArrangement(value, records)` takes the parts it checks against, because the registry is asynchronous.
- The full `arrangementSchema(records)` and `refuseArrangement` agree on everything the schema can express, and a test holds them to it. Only `refuseArrangement` can say "one name, one part", and it says everything plainly.
- An Arrangement's record is an arkku kind, `arrangement`, with the same frontmatter as a part's.
- A `Place`'s `before` and `after` carry part ids. If a later step needs the neighbours' instance names, they are added beside the ids, not in their place.

### Step 3 in detail: composer, to look

What to build, and nothing more:

- `packages/composer/`, a workspace package added to `lint` and `test`, depending on `parts` and `melody` only: no mind, no music, no Archive, no Studio.
- `packages/composer/lib/layout.ts`: `layoutOf(arrangement, parts, tune, tempo)`, a plain function, tested, that gives each instance what the diagram draws:
  - its name and part id;
  - its start and length in beats, and in seconds at `tempo`. A part with `beats` lasts that long. A part with phrases lasts as long as its phrases' notes, summed from the notes as `melody` gives them; if melody has no function for this, export one there.
  - its ending from `ending(part, place)`;
  - its neighbours from `placesOf`;
  - whether its words are heard elsewhere in the Arrangement: the other indices with the same name.
- `packages/composer/index.ts`: a `Bun.serve` on `COMPOSER_PORT` (default 3200), started with `bun run composer`. It answers:
  - `/`: the page.
  - `/parts.json`: every part the registry finds, with its record's title and text, `words`, `ending`, `beats`, and its parameters with their ranges, defaults and descriptions, read from its schema.
  - `/arrangements.json`: every Arrangement, each with its layout at the first tune and a tempo the request may give (`?tempo=`, default 72).
- The page lives in `packages/composer/public/`: plain HTML, CSS and a classic script, as the Receiver's page is, with no framework. It shows:
  - **The parts**: a card for each, with its title, its record's words, what it is (written or none, how it ends, its beats if fixed), and a table of its parameters: name, range, default, description.
  - **An Arrangement**, chosen from a list, drawn as a diagram. Its instances stand in order along one line, each as wide as its beats. The colour comes from the part id; the colour is computed from the id, never looked up from a list of them. A tempo control redraws it in seconds.
    - Instances that share words are joined, or marked alike.
    - A part with no words says where it runs from and to.
    - Each part's end is marked as home (`full`) or open (`half`).
  - Nothing on the page can be changed yet; that is step 4.
- The page and the server name no part id. Everything they show comes from the JSON.

The proof:

- **Layout tests**: for `the-song` at 72 bpm:
  - the ten instances are in order;
  - each bridge lasts 16 beats;
  - each written part lasts as long as its phrases;
  - the starts add up with no gaps;
  - the two `chorus` instances point at each other;
  - the endings and neighbours are those step 2 proved.
- **Interchangeable**: a test adds a made-up part in a temporary parts folder and checks that `/parts.json` and the layout include it without any code changes. If the registry can't yet be pointed at another folder for this, give it that option (it already takes `home`).
- **No closed union** in `packages/composer`, as in parts.
- **Seen**: run it on xitra, capture the page at `the-song` with Playwright (as `packages/marketing` captures), and include the image's path in the review message, so the Composer session can look at it.
- `bun run lint` and `bun run test` pass.

Then message the Composer session for review.

Built as a1e763b. `melody` now exports `phraseBeats`. The layout is drawn at the first tune, as the tune first has it: a chorus's first line grows past that with the Song's age, so the chorus is drawn shorter than it is sung in a later iteration.

### Step 4 in detail: composer, to change

First, if it is not already done: packages/parts on TypeBox 1.x (see step 1), in its own commit.

What to build, and nothing more:

- **The server stays read-only.** It never writes a file. Git is where Arrangements are kept: the scientist downloads a file and commits it into `packages/parts/arrangements/<id>/`.
- `POST /check` takes an Arrangement as JSON (and `?tempo=`). It answers `{ refusal }`, with `refuseArrangement`'s plain words, or `{ layout }` from `layoutOf`. Checking happens only here, on the server, against the parts the registry finds; the page never repeats the rules.
- The page gains an editor for one Arrangement at a time:
  - **Start** from any Arrangement in the list (a copy, with a new id and title to give), from an empty one, or by opening a `.json` file from disk.
  - **Instances**:
    - add one, choosing its part from the parts the server lists;
    - remove one;
    - move one earlier or later;
    - name it.
    - Naming an instance after another is how words are shared; the page says so beside the name.
  - **Parameters**: for each instance, a control per parameter of its part, made from the schema's minimum, maximum, default and description. A parameter left alone is not written into the declaration, so the part's default stands; a "reset" removes one that was set.
  - After every change the page asks `/check`. It redraws the diagram and the table from the answer, or shows the refusal plainly beside the editor, keeping the last good drawing dimmed beneath it.
  - **Save**: download `<id>.json`, the declaration exactly as `/check` accepted it, pretty-printed with two spaces as `the-song`'s is. Saving is refused while `/check` refuses.
  - The unsaved draft is kept in the browser's `localStorage`, so a reload doesn't lose it, wrapped in try/catch, as a convenience only.
- From step 3's review:
  - mark an instance whose line may grow (the layout carries `grows` from any of its lines' `measure`), e.g. "grows with the Song's age";
  - let the part cards' parameter tables breathe: the description on its own row or below, not a narrow column;
  - show a bridge's full name on hover where its block is too narrow.

The proof:

- **`/check` tests**:
  - `the-song` gives the same layout as `/arrangements.json`;
  - each refusal step 2 proved comes back as `{ refusal }` with its words;
  - an Arrangement of a made-up part from a temporary folder is accepted.
- **Round trip, end to end**, with Playwright against the server on xitra (captured from the Mac's Chrome through the tunnel, as in step 3):
  - start from `the-song`, give it the id `no-bridges`, remove the four bridges, set `verse-1`'s wordiness to 0.9, and save;
  - the downloaded file is accepted by `refuseArrangement`, and `readArrangements` reads it when placed in a temporary `arrangements/no-bridges/` with a record;
  - its instances are the six parts with words, in order, and `verse-1` alone carries a parameter.
  - Write this as a script in `packages/composer` that can be run again, not a one-off.
- **Refused, seen**: the same run sets a name already used by a different part, sees the refusal on the page, and finds Save disabled.
- Capture the page twice, editing `no-bridges` and showing a refusal, and send both paths in the review message.
- `bun run lint` and `bun run test` pass.

Then message the Composer session for review.

Built as e2b1e38 and reviewed: steps 1 to 4 are done. `bun run composer` serves the page on `COMPOSER_PORT` (3200). `bun packages/composer/roundtrip.ts <url> <folder>` proves the round trip again against a running Composer; it needs Chrome, so it is run by hand, not in `bun run test`. Nothing in the Studio, the Radio, the Receiver or the Archive has changed.

### Steps 5 to 7 in detail: a map of the concepts, and a page for each

The scientist's wish, 2026-11-21: the composer's front page shows how the concepts of a Song relate, as a diagram, and each concept leads to a page of its own. Where there is nothing to edit, the page illustrates the concept's variables and draws its inner structure. The map the scientist approved, drawn in the Composer session:

- **Shapes it** (coral): Mood (mode and tempo), Perspectives (Facets make the Settings), Tides (the Settings drift slowly).
- **Composer edits** (purple): Arrangement (instances in order), Parts (verse, chorus, bridge).
- **Made every Song** (teal): Tune (phrases, evolving), Lyrics (written by the mind), Score (words on notes), Beds (MusicGen from the guide), Song (the Session, aired and kept).
- **How they lead into one another**:
  - the Mood gives the Tune its mode;
  - the Perspectives and the Tides set the Parts' parameters;
  - the Arrangement orders the Parts;
  - the Parts choose the Tune's phrases and measure the Lyrics;
  - the Tune and the Lyrics make the Score;
  - the Score guides the Beds;
  - the Beds and the Lyrics make the Song.

Each concept is a folder, as the parts are: `packages/composer/concepts/<id>/`, holding:
- `concept.md`: its record. The frontmatter has `band` (`shapes`, `edits` or `made`) and `leads` (the ids it leads into); the body says what the concept is.
- `data.ts`: a default export that gives the page's JSON, made from the packages that own the concept.
- `view.js`: a classic script that draws the page from that JSON.

The server finds the concepts by reading the folders and serves `/concepts.json` (records and links), `/<id>/` (the page) and `/<id>.json` (its data). No list of concepts and no list of links is written in code, and adding a concept is adding a folder.

The composer may now import `mood`, `perspectives`, `tides` and `song` as well as `parts` and `melody`, to read them only: never the mind, the throat, the band, the Studio, or the Archive over the network. Where a value lives in a package the composer must not import (the Beds' kinds in `music`, for instance), export it from a package it may import, or say it in the concept's record. Never copy code.

**Step 5, the map.**
- `/` draws the map from `/concepts.json`. A box is a concept, coloured by its band, with its title and a short line; an arrow is a lead. Lay it out by band, top to bottom (shapes, edits, made), in a way that needs no coordinates written per concept: a new concept finds its place by its band and its leads.
- Every box links to its page.
- The parts cards move to `/parts/`, and the Arrangements' drawing and editor to `/arrangement/`, unchanged. All ten concepts' folders are made in this step, with their records and leads, so the map is whole from the start. The pages that come in steps 6 and 7 say so until then.
- Proof:
  - every folder is on the map;
  - every lead names a concept that exists, and the map refuses one that doesn't, loudly, naming the folder;
  - a made-up concept in a temporary folder appears on the map, linked, with no code changed;
  - the step 3 and step 4 tests still pass at their new addresses, and `roundtrip.ts` follows them;
  - a capture of the map.

**Step 6, the pages of what shapes a Song.** Each shows the concept's variables with their ranges and defaults, and draws how it moves:
- **Mood**: `firstMood` and what a Mood holds, its character (mode and tempo) and its weather. Draw the mode as a scale, the degrees the Tune is sung in, and the tempo's range.
- **Perspectives**: every Perspective, found as the package finds them, with its record. Show which Settings it turns and how far, and its weight. Then show the Settings themselves (`defaults(1)`) as a tree, each leaf with the Perspectives that can move it.
- **Tides**: every Tide with its record, the Setting it moves, its range (`validRange`), and its envelope drawn as a curve over a long stretch of iterations (`valueAt` at many positions), with today's position marked.
- Proof: each page's JSON is tested against the package it comes from (every Perspective and every Tide is there; the ranges are the packages' own); a capture of each page.

**Step 7, the pages of what a Song makes.** Each is illustrated from the first tune and sample values:
- **Tune**: `firstTune`'s verse and chorus phrases drawn as a piano roll (degree by beats), the rests between them, and the chorus's reciting note marked. Then a few iterations of `evolve`, so the verse can be seen moving step by step while the chorus stays, and a Song's Variations (`variations`).
- **Lyrics**: the five fields of `Lyrics` and the instances of `the-song` they fill. For each line, its `measure` at a tempo (target and most, drawn as syllable slots), wordiness moving it, and the chorus's first line, `chorusOpening`, at a few iterations (1, 12, 2548), growing.
- **Score**: one phrase and one sample line, fitted (`fitToCount`) at a tempo and rate. Draw the notes with their syllables on the sixteenth grid, `spacing`'s `k`, and a line that grows on the reciting note.
- **Beds**: the guide made from the Scores (`setGuide`) and what the Beds are told: their kinds, including the bridges' `bridge:verse>chorus`. Say plainly that the Beds themselves are made by MusicGen from the guide, and are not drawn here.
- **Song**: what a Session records (its parts in order with their kinds, their words and timing), with `the-song` laid out as a Session's parts would be. Say plainly that a recorded Song is in the Archive, not here.
- Proof: each page's JSON is tested against the functions it is made from; a capture of each page.

All three steps: `bun run lint` and `bun run test` pass. After each push, message the Composer session for review with the commit range and the captures.

Built and reviewed: step 5 as 6160a0e, the map's routing made provable (`mapOf`, `/map.json`) as f3b29b4, step 6 after it, step 7 as 0bd1261, and its fixes as 2873c96. Steps 1 to 7 are done. Where building settled things the brief left open:
- The Tides are marked at a Song given by `?song=` or `COMPOSER_SONG` (default 1), since the Composer reads neither the Archive nor the Radio.
- The Score counts syllables with the throat's pronouncing dictionary where the throat is built (xitra), and by a rough rule elsewhere, shown in italics. A word stands under its first note, with a dash under each note that carries the rest of it.
- The pages write no part id themselves: names come from the data (the Tune's own keys, the part that holds the Song's age). The code under `lib/` may use `melody`'s and `song`'s own names.
- The Score's and the Beds' sample words are Song 1192's first verse, written into `lib/making.ts`. The Beds' guide is a fixed-seed sample, not any real Song's.

## The Arrangement as a timeline (robot, with the scientist, 2026-11-23)

The scientist, on the iteration count: what an iteration does to a Song (the whole order walked twice, new words each time, a verse continuing the verse in the same place, the chorus heard twice with one number) is `the-song`'s logic, and another Arrangement must be able to break it. The Arrangement is a DAW's timeline, not a fixed order of parts. The Beds are one instrument among others, not the only source of the band. A drum track may run under the whole Song. Today's bed tails, a bed grown past its section and faded under the next, are already this idea: blocks on different tracks overlapping on the timeline.

### What the timeline holds

- **Regions** are the instances of parts, in order, as they are now. They are the musical structure: the phrases, the words, where each part comes home. On the timeline they are what a DAW's markers are: they say what the music is at each moment, not what sounds.
- **Tracks** are lanes, one for each kind of thing that sounds. A Track is a module in a folder (`packages/parts/tracks/<id>/`, with a `track.md` and a `track.ts`), a subclass of one interchangeable superclass, **Track**, as the parts are. It declares what its blocks are made from and by what. Today's are:
  - `voice`, the lead and the choir, sung by the throat from a Score;
  - `bed`, an instrument grown by MusicGen from a hummed guide;
  - `guide`, made and never heard: what a bed grows from.

  A Track that nothing makes yet (drums, before an instrument that can play a whole Song exists) may be declared and drawn, and is said to make nothing.
- **Blocks** are the clips on a Track. A Block has its Track, a **key**, where it begins and ends (by anchors, below), a fade in and a fade out, a gain, and its source: what it is made from, e.g. the region whose words it sings, or the regions whose guide it grows from.
  - **The key is its content.** Blocks with one key are one sound, made once and placed again. A new key is made anew. Repetition is keys reused: in `the-song` the chorus's blocks share a key within a pass, and the second pass has new keys for everything, which is all an iteration is. An Arrangement whose keys are all different repeats nothing.
  - **Blocks overlap freely**, on different Tracks and across regions. A bed reaching past its region and fading out is today's tail, written as data. A drum block from the first region to the last is the same, longer.

### Anchors, not coordinates

A region's length is not known until its words are fitted. The chorus's first line grows with the Song's age, lines take grace, and a bridge is a fixed length. So a Block is placed by **anchors**:
- "where region `chorus` (its 2nd hearing) begins";
- "3 seconds after region `verse-2` ends";
- "the start of the first region" … "the end of the last".

`resolve(arrangement, lengths)` turns anchors into beats and seconds once the regions' lengths are known. The composer resolves with the first tune's lengths, as `layoutOf` does now. The Studio, later, will resolve with the fitted ones. So making is two passes: make every distinct key, then lay out and mix.

### Tempo

- An Arrangement has a **tempo map**: a tempo for each region, given where it changes and held until the next change. A tempo may be **null**: free time, no beat, no grid.
- `the-song` has one tempo for the whole Song, the Mood's, as now. Another Arrangement may change tempo where a part changes, have a bridge in free time, and return to the first tempo after it.
- A region in free time has its length in seconds, given in the Arrangement, since there are no beats to count. Blocks in it are placed and faded in seconds.
- A part with words cannot yet be sung in free time. Fitting words to a phrase needs the sixteenth grid, so the schema refuses a part with written words in a region with a null tempo, saying why, until a free-time fitting exists. A part with no words may: a hummed bridge in free time is the first use.
- Changes are jumps for now. A ramp (accelerando, ritardando) is still open.

### The Song's age

Which number a part that sings the age sings is decided by its key: each distinct key of such a part sings the next number. The one rule no Arrangement can break, as `verse`, `chorus` and `bridge` can never be removed: **the Song's age only goes forward**, across every Arrangement, in one count. An Arrangement may move it by any amount, including none.

### What the Archive already has

A Session's `recordings` are already a timeline: every audible thing is a clip with its `kind` (`voice`, `bed`), its `at`, `seconds`, `fade` and `gain`, named by the hash of what it is, so one sound placed twice has one name. The Receiver already plays a flat list of clips at their moments. What the timeline adds there later, as an addition and never by raising `version`: which Track each recording is on, and the tempo map.

### Step 8 in detail: the timeline

What to build, and nothing more, in `packages/parts`:
- `lib/track.ts`: the abstract `Track` class (`id`; `makes`: what it is made from, or nothing yet; `heard`: whether it sounds; its block parameters as a TypeBox schema, such as gain and fade ranges). Add a registry by folder as the parts have, and `tracks/voice/`, `tracks/bed/`, `tracks/guide/`, each with its record and module, declaring today's behaviour.
- `lib/timeline.ts`:
  - the Block, Anchor and tempo map types and schemas;
  - `resolve(arrangement, lengths)`, giving every region and Block its start and length in beats (where there is a tempo) and seconds (always).
- The Arrangement schema grows, by addition, to `tempo` (the map), `tracks` (the ids it uses) and `blocks`. An Arrangement without them is read as it always was, so `the-song` as it stands still checks.
- `refuseArrangement` refuses, plainly:
  - a Block on a Track that does not exist;
  - an anchor naming a region that does not exist;
  - a Block that ends before it begins;
  - one key on two Tracks, or with two different sources;
  - a null-tempo region without its seconds;
  - a part with written words in a null-tempo region.

The proof, as tests:
- `resolve` on made-up Arrangements:
  - a Block across three regions;
  - a Block ending 3 seconds after its region, fading;
  - a tempo change at a region, where the beats restart from the new tempo and the seconds run on;
  - a null-tempo region in the middle, whose seconds are its own and whose beats are none.
- Every refusal above, said plainly.
- A made-up Track in a temporary folder is usable with no code changed.
- No closed union of Track ids or part ids in the package.

Built as 8df5174 and reviewed. Decided in the review, for step 9:
- **A pass is not a field.** Each pass's instances have distinct names (the second pass of `the-song`, e.g. `verse-1-again`). An optional `continues` on an instance names the instance whose words it follows from. Today's rule, that a verse continues the verse in the same place in the iteration before, becomes data in `the-song`, and an Arrangement in which nothing continues writes everything fresh. A `continues` naming nothing, or naming another part's instance, is refused.
- **`tracks` is binding**: the lanes the Arrangement draws, including a lane with no Blocks. A Block on a Track not listed is refused.
- **Nothing before 0**: a Block may not begin before the Song does. A pickup before the first region is the Intro's question.
- **A fix in `resolve`**: a moment past the Song's end is in the last region, and one before its start is in the first.

### Step 9 in detail: the Song as a timeline

- `arrangements/the-song/` becomes a timeline:
  - the ten regions twice, one set per pass;
  - one tempo, the Mood's, given as "the Mood's" and not a number;
  - a `voice` Block on each sung region;
  - a `bed` and a `guide` Block on every region, the bed reaching `tail` seconds past its region's end (3, `music/lib/bed.ts`) and fading as `studio/lib/session.ts` and the Receiver fade it now.
  - The chorus's Blocks share a key within a pass; everything is new in the second pass.
- **Proof of equivalence**: resolved at the first tune and 72 bpm, it gives what the Studio lays out today for a Song of two iterations: the same regions in the same order and timing, the same bed for each part with the same tail and fade, and the same sharing. Write today's rules out in the test from the Studio's code (as step 2 did with `perform.ts`'s cadence rule); don't import the Studio.
- **A second Arrangement**, `tempo-turns`, to prove what `the-song` can't:
  - one pass;
  - its second bridge in free time (null tempo, its own seconds), hummed;
  - the chorus after it at a different tempo;
  - the first tempo back for the last verse;
  - one bed Block running under two regions.
- `ITERATION_COUNT` stays in the env for the Studio until the Studio moves (step 12). The composer reads the passes from the Arrangement.

Built as 390befb and reviewed. Then, from the scientist (2026-11-23): **the iteration is a marker**, as a tempo change is, so that nothing binding is built on it:
- An Arrangement may list **turns**: anchors where the words turn over and a new iteration begins.
- Within an iteration, regions of one name sing the same words, as the chorus does. A name heard after a turn continues its own words from before the turn.
- **The Song's age moves at a turn.** Each iteration sings the next number. An Arrangement with no turn is one iteration with one number, and one that wants a new number for every chorus puts a turn before each. The age still only goes forward.
- `the-song` goes back to its ten names, listed twice, with one turn at the second hearing of `verse-1`. The "-again" names and their `continues` go. `continues` stays as an optional tool, to follow a *different* name's words.
- **An instance may say its own `ending`** (`full` or `half`), and its place takes it over the part's. `the-song`'s `final-chorus` says `full`, so every iteration comes home as the Studio makes it now, with no rule about turns. Cadence equivalence across both iterations joins the proof.
- Blocks' keys stay explicit: a turn changes no key by itself.

### Steps 10 and 11 in detail: the timeline in the composer

- **Step 10, to look.** The Arrangement page draws the timeline as a DAW draws a session:
  - the regions along the ruler, coloured by part as now;
  - a tempo lane above, with free time drawn plainly as free (no grid);
  - the Tracks as rows below;
  - the Blocks on them, coloured by key so a sound placed again is seen as the same (the shared letter, as now), with overlaps shown and fades drawn as ramps.

  The ruler is in seconds, since free time has no beats, with the bars drawn where there is a tempo. A Track that makes nothing yet is drawn, empty, and says so. Proof: `resolve` tests at the server's `/arrangements.json`; no part or Track id in the page; captures of `the-song` and `tempo-turns`.
- **Step 11, to change.** In the editor:
  - add, move, stretch, re-key and fade Blocks;
  - set the tempo map, including free time with its seconds;
  - every change is checked by `/check` as now, and saved as a file.

  Proof: `roundtrip.ts` grows to make `tempo-turns` from `the-song` in the editor and save it, and the saved file equals the one in the repo.

Built and reviewed: step 10 as 30a77ae, with its fixes in 8168842 and 6dedf1d (words shared within an iteration only, a "↩" where a name continues across a turn, the order table from `resolve`, Blocks marked by their Track's initial and a number, `beatsPerBar` in `melody`), and step 11 as 2959298. Steps 1 to 11 are done. `POST /format` is the one place an Arrangement's file text is made, so the editor's file and a hand-written one are the same text. `roundtrip.ts` makes `tempo-turns` from `the-song` in the editor, byte for byte.

## Learn and Edit (robot, with the scientist, 2026-11-23)

The scientist asked for more flesh on editing, and for the composer to be remade around two modes, chosen by a toggle at the top right: **Learn | Edit**.

- **Learn** explains the concepts as the pages do now: words with diagrams, and the diagrams' own visualisations. Nothing in Learn is changed by hand.
- **Edit** is the tool to pick up once you understand enough. Each concept's page in Edit is a workspace for changing that concept, and it is judged by how easy it is to use. Its words are short hints; the explaining stays in Learn.

### What can be edited, by concept

Not every concept is a file the scientist keeps, so Edit has three kinds of workspace:

- **Files**: the Arrangement, the Perspectives and the Tides. These are records in git. They are edited, checked by the server against their own rules, and saved as files.
- **Parameters**: the Parts. A part is code, and its shape can't be edited. What can be edited is what an Arrangement gives each of its instances, within the part's schema. That is saved into the Arrangement.
- **Benches**: the Mood, the Tune, the Lyrics, the Score, the Beds and the Song. These are made by the mind and the band, not kept. On a bench you change what goes in and see what comes out: a line of words fitted to a phrase, a Mood moved on its weather, a tune evolved a few steps. Nothing on a bench is saved; it is for learning by hand what the made things do.

### What every Edit workspace shares

- **The mode is in the URL** (`?mode=edit`), so a link, a reload or a capture keeps it. The toggle swaps the mode on the page you're on. The browser remembers the last mode only as a convenience.
- **The map** is the same in both modes. In Edit, each concept says which kind of workspace it has, and a concept with nothing to edit says so rather than hiding.
- **One shell**:
  - which file is open, as a picker, with new, copy and open-from-disk;
  - an unsaved mark;
  - undo and redo, as buttons and as Ctrl/Cmd-Z and Shift-Ctrl/Cmd-Z, across every kind of change;
  - the check's answer shown on the thing it is about (the Block, the instance, the field), not only in a list. While the check refuses, the last good drawing stays dimmed beneath.
- **Saving stays as step 4 made it.** The server never writes a file. Save downloads the file as `POST /format` makes it, and it is refused while the check refuses. Git is where files are kept, and the scientist commits them. A draft is kept in `localStorage` as a convenience only.
- **Learn loses its editors.** The Arrangement page in Learn draws and explains; its rows of fields move to Edit, where they become the inspector of what is selected.

### The Arrangement's hands

The Arrangement in Edit is a DAW's session that you work with the mouse. Fields remain, in an inspector beside it, for exact values.

- **Blocks**:
  - drag a Block's body to move it, and its ends to stretch it;
  - drag in an empty stretch of a Track to draw a new Block;
  - Alt-drag (Option-drag on a Mac) to copy a Block with the same key, which is the same sound heard again; "make unique" gives a copy a key of its own;
  - drag a fade's handle at a Block's top corner, and drag the gain line up or down;
  - pick a Block's key from the keys already on its Track, or a new one;
  - pick its source by clicking a region on the ruler;
  - Delete removes the selection, and the arrow keys nudge it.
- **Snapping**: an edge snaps to anchors, the region edges and the hearings, and to bars where there is a tempo. While dragging, the anchor it will be written as is shown, e.g. "verse-1 end + 2.0 s". Holding Shift turns snapping off, and the drop is then written as the nearest anchor plus seconds. The page never invents a coordinate the timeline can't hold: what it writes is always an Anchor.
- **Regions**:
  - drag an instance along the ruler to reorder it;
  - in free time, drag its right edge to set its seconds;
  - its menu adds an instance after it, removes it, names it and sets its ending. Naming it after another still shares their words, and the page says so.
- **Tempo**: points on the tempo lane, each at a region and its hearing. Click to add one; drag it to another region; type its value, choose the Mood's tempo, or make it free.
- **Turns**: markers on the ruler, dragged from region to region, added and removed as tempo points are.
- **Seeing**: zoom with Ctrl/Cmd-scroll or a slider, scroll along the Song, and fit the whole Song to the window. Selected things are plain to see, and each mark (letter, ramp, gain line) means the same as in Learn.

### The Parts, the Perspectives and the Tides in Edit

- **Parts**:
  - choose an Arrangement, then an instance from its strip;
  - each parameter becomes a slider within its range, with the default marked and a reset;
  - each line's `measure` (target, most, whether it grows) is drawn as bars and redrawn as a slider moves, from the server, not from rules repeated in the page.
- **Perspectives**:
  - a Facet's Turns and Weights, edited;
  - `clash` shown where Facets fight;
  - the Settings that `resolve` gives drawn with the edited Perspective and without it.
- **Tides**:
  - a tide's envelope drawn, with its points dragged within `validRange`;
  - its value at a chosen Song number shown, and that number moved along the envelope.

These need what the Arrangement already has: a check on the server against the package's own rules, and one formatter on the server, so a file saved from the editor reads exactly like one written by hand.

### The benches

Each bench starts from the Learn page's sample values, and has a "back to the sample" button.

- **Mood**: drag on the weather (mode and tempo), and see the first tune's character and tempo follow.
- **Tune**: choose a mode and a number of steps, evolve it, step back, and see each phrase change.
- **Lyrics** and **Score**: type a line for a phrase, and see its syllables fitted to the notes as the Score would set them. Rough syllables are marked, and the line that would grow with the Song's age is marked as such.
- **Beds**: choose a part kind, and see the guide that MusicGen would be given. No MusicGen is run.
- **Song**: choose an Arrangement and a tempo, and see the Session it would make: its parts in order, with their seconds and the recordings they would name.

### Steps 12 to 15 in detail

- **Step 12, two modes.**
  - The toggle, the mode in the URL, the map in both modes, and the Edit shell (picker, unsaved mark, undo and redo, the check shown on its thing).
  - The Arrangement's editor moves out of Learn into Edit, as today's fields in an inspector beside the drawing.
  - Proof:
    - `roundtrip.ts` runs in Edit as now, and undoing every step gives back a file byte-equal to `the-song`;
    - no editor is in any Learn page;
    - captures of a concept in Learn and in Edit.
- **Step 13, the Arrangement's hands**, as above.
  - Proof: `roundtrip.ts` grows a second run that makes `tempo-turns` from `the-song` with the mouse alone (Playwright's mouse: drags, clicks, menus, typing only where a number is typed), and the saved file equals the repo's byte for byte.
  - Tests for the anchor a drop is written as: snapped, unsnapped, and in free time.
- **Step 14, the Parts, the Perspectives and the Tides in Edit**, as above.
  - Proof:
    - a check and a format endpoint for each kind of file, with tests that each file in the repo is accepted and formats to itself;
    - a round trip for each: change one thing and save; the file is accepted and differs only in that thing;
    - captures.
- **Step 15, the benches**, as above.
  - Proof:
    - the bench answers come from the same functions as the Learn pages;
    - tests that a bench at its sample values gives exactly the Learn page's drawing;
    - captures.

Each step is reviewed by the Composer session, as before.

### Still open

- **The Intro as a part.** It could be a part whose making waits for its Song to have aired, played or not by what triggers it. It is decided when the other parts are written out and it can be seen whether anything in the intro cannot be a parameter.
- **Tempo ramps.** Changes are jumps; an accelerando or a ritardando between two tempi is decided later.
- **Words in free time.** Fitting words without a grid, so a part with written words can be sung where the tempo is null.
- **A Track that plays the whole Song.** A maker for a drum Track, or any instrument longer than a bed: the wasm instruments idea.
- **Facets in an Arrangement.** How an Arrangement's ranges for Facets meet the Perspectives and the Tides.
