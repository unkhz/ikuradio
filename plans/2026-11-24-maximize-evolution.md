---
date: 2026-11-24
owner: scientist
state: draft
id: 22
kind: plan
slug: maximize-evolution
---

# Maximize evolution

"Evolution of Song" (`plans/2026-11-21-evloution-of-song.md`) broke the Song open into Parts, Tracks, Blocks and Arrangements, and gave the scientist a Composer to look at and edit them. "The Studio on timelines" (`plans/2026-11-23-studio-on-timelines.md`) has now switched the live Studio onto timelines (Steps 1–5 complete and verified on the air; Step 6 brings `tempo-turns` live).

Even with the Studio running on timelines, the Song's musical space is still hemmed in by eight architectural ceilings left over from the pre-composer world: fixed musical grammar (key of A, 4/4 time, four-line stanzas), five fixed lyric slots, three disconnected parameter systems that barely compose with each other, narrow Block and Track parameters, hardcoded choir and mix rules, closed Archive unions, and no feedback loop letting Arrangements enter the eternal stream or be auditioned quickly in the Composer.

This plan names those ceilings and lays out the architectural phases to lift them, so the Song can evolve across every musical dimension over a quadrillion years — not only in the order of its sections, but in its meter, harmony, voices, instrumentation, space, and form.

## Where this sits

- **Depends on:** `plans/2026-11-23-studio-on-timelines.md` (Steps 1–5 already live; Step 6 overlaps Phase 1 below).
- **Absorbs and orders:** the remaining Step 16 and "Still open" items from `plans/2026-11-21-evloution-of-song.md`, plus the unstarted musical evolution threads from earlier plans (key changes from `plans/2026-11-13-perspectives.md`, convergence memory from `plans/2026-11-14-a-melody-for-every-iteration.md`, and melody homecoming from `plans/2026-11-14-progressions.md`).
- **How it is executed:** this is a master architectural roadmap. Each phase is designed to be spun off into its own focused implementation plan when chosen, built one step at a time, and reviewed in the usual loop.

## The rules this plan keeps

- **The Archive is forever; readers grow by addition.** `sessionVersion` is never raised. Every Song already in the Archive still plays on every Receiver, and `verse`, `chorus` and `bridge` can never be removed.
- **MusicGen never runs without a guiding audio input.** New non-MusicGen Tracks (procedural, sample-based, or WebAssembly instruments) may render without a hummed guide, but MusicGen itself is only ever conditioned on audio that ties tonality, rhythm and groove to the Song.
- **The Song's age only goes forward.** Across every Arrangement, meter, and key, the iteration count moves strictly forward in one continuous line.
- **No closed unions in new abstractions.** Parts, Tracks, Parameters, Tides and Perspectives are discovered from folders and schemas, never frozen behind `'verse' | 'chorus' | 'bridge'` or `'voice' | 'bed'`.
- **`the-song` stays Song-for-Song equivalent by default.** Lifting a ceiling never forces `the-song` to change how it sounds until an Arrangement, Tide, or Perspective explicitly uses the new capability.

---

## The eight architectural gaps, and the phases to close them

### Phase 1 — Open the Archive and Session by addition
*Packages: `archive`, `radio`, `ui`, `studio`*

**Current ceiling:**
- `SessionPart.type` and `SessionGuide.part` (`from`, `to`) in `packages/archive/lib/session.ts` are closed unions (`'verse' | 'chorus' | 'bridge'`).
- `SessionRecording.kind` is `'voice' | 'bed'` with no open `track` id, and `fadeIn` does not exist yet (only `fade` for fade-out).
- `Session` records only a single Song-level `mode`, `tempo`, and `sound`, and does not record which `arrangement` produced the Song.

**Target architecture:**
- Open `SessionPart.type` and `SessionGuide.part` to arbitrary string Part ids, carrying a lightweight display descriptor (`words: boolean` or similar) so older or newer Receivers can render Parts added after the page was built.
- Add `arrangement?: string` to `Session` (and index it in the Radio's SQLite search cache so listeners and the scientist can filter aired Songs by Arrangement).
- Add `track?: string` and `fadeIn?: number` to `SessionRecording` while keeping `kind` backwards-compatible for existing readers.
- Allow per-part/region overrides in `SessionPart` (`tempo?: number | null`, `mode?: string`, `tonic?: number`, `meter?: [number, number]`, `sound?: string`) — absent when matching the Song's top-level values.

**Proof:**
- All archived Sessions back to Song 0 decode and play unchanged; a Session carrying a made-up Part id, custom Track id, `fadeIn`, and per-part `tempo`/`mode` plays and renders cleanly on the Receiver and is searchable by Arrangement on the Radio.

---

### Phase 2 — Track-specific Block parameters and per-block musical overrides
*Packages: `parts`, `studio`, `composer`, `melody`, `music`*

**Current ceiling:**
- A `Block` in `packages/parts/lib/timeline.ts` only carries `source`, `gain`, `fadeIn`, and `fadeOut`.
- Choir membership (`choir.size`, `choir.verses`), vocal delivery (`breath`, `humanness`), band description (`Mood.character.sound`), and harmonic progression are all locked at the Song or Part-kind level. Only the hardcoded `bridge-beds` Facet can swap a band prompt, and only for bridges.

**Target architecture:**
- Let each `Track` subclass (`packages/parts/lib/track.ts`) define a rich TypeBox parameter schema for Blocks on that Track, validated by `refuseArrangement` and edited directly in the Composer's Arrangement inspector:
  - **`voice` Blocks:** singer subset / voicing (e.g. solo lead, duet, full choir, unison octave, countermelody), per-block `breath`, `vibrato`, `humanness`, and harmony rule overrides.
  - **`bed` Blocks:** band prompt override or modifier (e.g. `"solo cello"`, `"add hand percussion"`, `"stripped to ambient drone"`), energy/density hints, and `melody` conditioning toggle.
  - **`guide` Blocks:** per-block `progression` (`roaming | known`, temperature, pull), cadence override, harmonic rhythm density, or atonal row.
- Pass resolved Block parameters from `makingsOf` into `perform`, `humGuides`, and `underlay` so Arrangements become genuine orchestration sheets, not just section reorderings.

**Proof:**
- An Arrangement can run verse 1 with solo lead over stripped piano, verse 2 with a duet, and the final chorus with full choir and percussion — declared entirely as Block parameters, validated by schema, edited in the Composer, and rendered identically by the Studio.

---

### Phase 3 — One unified, addressable parameter tree (`Parts`, `Tides`, `Perspectives`, `Arrangements`)
*Packages: `parts`, `tides`, `perspectives`, `composer`, `studio`*

**Current ceiling:**
- Three incompatible configuration models exist side by side:
  1. `Part.parameters` (`packages/parts/lib/ranges.ts`) only declares 4 numbers (`wordiness`, `ceiling`, `span`, `travel`).
  2. `Tides` (`packages/tides/lib/tides.ts`) hardcode `Moves` to those exact 4 numbers across `'verse' | 'chorus' | 'bridge'` — you cannot put a Tide on tempo, humanness, choir size, progression temperature/pull, vibrato/breathiness, mix balance, or a custom Part.
  3. `Perspectives` (`packages/perspectives/lib/facets.ts`) hardcode 12 Facets with `'verse' | 'chorus' | 'bridge'` sub-objects, keep their Turns as executable TypeScript (`actions.ts`), and can only apply to a whole Song.
- Arrangements cannot constrain Facet ranges (an original goal of `plans/2026-11-21-evloution-of-song.md`).

**Target architecture:**
- Define one schema-derived **Parameter Registry** with uniform paths across scopes:
  - `song.<facet>.<param>` (e.g. `song.humanness.scale`, `song.choir.size`, `song.mood.tempoBias`)
  - `part.<partId>.<param>` (discovered dynamically from every active `Part` subclass, no closed union)
  - `track.<trackId>.<param>` (discovered dynamically from every active `Track` subclass)
- **Universal layering order:** `defaults` → `Mood` → `Tides` → `Perspectives` → `Arrangement` (ranges/clamps and per-region/per-block overrides).
- **Open Tides:** any bounded numeric leaf in the Parameter Registry becomes automatically targetable by a Tide, with its `validRange` read directly from the parameter's TypeBox schema rather than a hardcoded map in `tides.ts`.
- **Declarative Perspective Turns (Turns as data):** allow Perspectives to declare structured parameter deltas/overrides and optional region scopes in data (`turn.json` or frontmatter/schema) so the Composer can edit what a Perspective *does*, while keeping code Turns as an escape hatch for complex procedural behaviors.
- **Arrangement Facet bounds:** allow an Arrangement to declare min/max clamps or disallowed Facets so an intimate Arrangement can keep Tides and Perspectives within its aesthetic envelope.

**Proof:**
- Adding a new Part folder with a numeric parameter makes it immediately targetable in `/tides/` and `/perspectives/` in the Composer with zero code edits in `tides` or `perspectives`; a Tide on `song.humanness.scale` or `part.chorus.progression.temperature` validates, previews, and runs in the Studio.

---

### Phase 4 — Decouple Lyrics from `the-song`'s five fixed fields
*Packages: `parts`, `song`, `studio`, `composer`*

**Current ceiling:**
- `packages/parts/lib/words.ts` (`fieldsOf`) maps region names to the 5 hardcoded `Lyrics` fields (`firstVerse`, `secondVerse`, `thirdVerse`, `chorus`, `finalChorus`) via `arrange()`.
- Any Arrangement introducing a new vocal region name (`pre-chorus`, `verse-4`, `refrain`, `outro`) has no words in the Composer and cannot be made by the Studio.
- `Part` does not yet own its lyric-writing contract.

**Target architecture:**
- Move the lyric contract onto `Part` (`packages/parts/lib/part.ts`):
  - `instruction(place)`: what the mind is asked to write for this Part.
  - `rhyme` / `structure`: whether lines rhyme with a fixed line (like the chorus's age), follow a scheme, or stand free.
  - `memory`: whether the Part draws from the mind's thoughts, robot telepathy, the previous pass of the same name, or a `continues` target.
  - `fixedLine(line, place)`: already on `Part`, generalized so any counting/refrain Part can own fixed lines.
- Generalize `Lyrics` from a 5-field struct to a map keyed by region identity (`Record<string, string>`) per pass, while keeping a lossless compatibility projection for `the-song` and archived diary entries.
- Let `continues` chain across arbitrary region names and passes, with wear/echo refusal applied uniformly across all written regions in the Song.

**Proof:**
- An Arrangement with `verse-1`, `pre-chorus`, `chorus`, and `outro` writes fresh, fitted, wear-checked words for every vocal region without touching `packages/song` or hardcoding field names.

---

### Phase 5 — Lift the hardcoded musical grammar: tonic, meter, and stanza shape
*Packages: `melody`, `mood`, `parts`, `studio`, `composer`*

**Current ceiling:**
- **Tonic is always A** (MIDI 57), even though `Key = { tonic, mode }` already exists in `packages/melody/lib/scale.ts`.
- **Meter is always 4/4** (`beatsPerBar = 4`, straight 16th-note grid, no triplets or swing).
- **Stanza shape is always 4 lines** (`chorusHook` and `verseWalk` in `packages/melody/lib/hooks.ts`), 2 bars per line + 3 bars on the last.

**Target architecture:**
- **Key & modulation map:** add an optional `key` lane alongside the `tempo` lane on a Timeline (`{ region?, hearing?, tonic?: number | 'mood', mode?: ModeName | 'mood', shift?: number }`), allowing Song-level tonic choice, non-7-note/pentatonic/modal scales, and deliberate modulations (e.g. lifting the final chorus by a tone or a minor third — completing the deferred key-change idea from `plans/2026-11-13-perspectives.md`).
- **Meter & groove:** add `meter` (`[numerator, denominator]`, default `[4, 4]`) and `subdivision` (`straight | triplet | swing`) to regions/Arrangements. Generalize `fitBars`, `spacing`, stress placement, and strong-beat weighting in `packages/melody/lib/fit.ts` so 3/4, 6/8, 5/4, and triplet/swung rhythms work natively and never violate `SYLLABLES_PER_SECOND`.
- **Configurable phrase/stanza geometry on Parts:** let a `Part` declare its line count, bar lengths, rest patterns, and reciting-tone placement as data/parameters (e.g. a 2-line `pre-chorus` or 6-line `verse`), rather than reading only `tune.verse` and `tune.chorus`.
- **Long-horizon melodic memory (optional sub-step):** bring in the deferred convergence memory (`plans/2026-11-14-a-melody-for-every-iteration.md` Step 4) and melody homecoming (`plans/2026-11-14-progressions.md`) as configurable parameters on the melody writer.

**Proof:**
- A waltz (`3/4`) Arrangement with a 2-line `pre-chorus` and a +2 semitone modulation into the final chorus fits syllables without violating `SYLLABLES_PER_SECOND`, renders cleanly in the Composer's Score/Tune/Arrangement views, and rehearses cleanly on `xitra`.

---

### Phase 6 — Timeline expressiveness and non-bed Track makers
*Packages: `parts`, `melody`, `studio`, `composer`, `ui`*

**Current ceiling:**
- Anchors (`{ region, hearing, edge, plus: seconds }`) cannot express musical time (`+2 bars`, `-1 beat` pickup) — bar-snapped drops in Composer serialize as seconds and drift if tempo or lyric length changes.
- Tempo changes are step jumps only (no accelerando / ritardando).
- Written words are refused in free time (`tempo: null`).
- MusicGen beds cap at 90 seconds (`packages/music/lib/bed.ts`) and produce a single baked stereo mix; no Track maker exists for instruments that run across regions or across the whole Song.

**Target architecture:**
- **Musical anchors:** extend `Anchor` with optional `beats` / `bars` offsets (resolved against the region's tempo and meter, with `plus` seconds retained for free time and tails), including negative pickup anchors (and resolving the Intro as a pre-0 pickup region/Part if desired).
- **Tempo ramps:** allow `TempoPoint` to specify `curve?: 'step' | 'linear'` so tempo can breathe smoothly across a bridge or finale.
- **Free-time vocal fitting (rubato):** add a beatless syllable-timing fitter bounded only by `SYLLABLES_PER_SECOND` and breath rests so spoken-sung or chant-like written Parts can live inside `tempo: null` regions.
- **New Track makers (WASM / procedural stems):** implement Track makers that read the resolved harmonic guide (`SessionGuide.chords`), tempo map, and meter directly — starting with a lightweight procedural/WASM instrument Track (e.g. `drums`, `bass`, `drone`, or `pad`) that can span the whole Song, be synthesized deterministically in the Receiver (just like Chimera WASM voices, zero Archive bloat!), and layer alongside MusicGen beds.

**Proof:**
- A bar-anchored Block stays locked to beat 1 of bar 3 when tempo changes from 72 to 96 bpm; a full-Song procedural/WASM Track plays sample-identically in Studio and Receiver alongside MusicGen beds.

---

### Phase 7 — Declarative choir, continuous vocal bodies, spatial mix, and FX
*Packages: `vocals`, `archive`, `ui`, `parts`, `composer`*

**Current ceiling:**
- Choirs in `packages/vocals/lib/singers.ts` are capped at 4 voices (`0, -2, -4, -7` steps) with fixed relative gains (`1, 0.55, 0.45, 0.4`) and 3 discrete bodies (`female | male | child`) — even though Chimera already supports continuous body blending (`female`, `child` weights, as Rezzy uses).
- Stereo panning, reverb/echo sends, EQ/filtering, vocal-over-bed ducking, and target loudness (`-16 LUFS`, `-6 LU`) are hardcoded in the Receiver/Archive mix logic rather than declared in the Song.

**Target architecture:**
- **Flexible choir & continuous bodies:** allow `Session.singers` and `voice` Block parameters to specify arbitrary choir sizes, voice roles (unison, octaves, counterpoint, bass drone), and continuous Chimera vocal-tract blends (`body: Singer | { female: number; child: number; ... }`).
- **Declarative mix & FX bus on Tracks and Blocks:** allow Tracks/Blocks (and `SessionRecording`) to declare:
  - `pan` (`-1` to `1`, or automatic stereo spread rule for choirs)
  - `send` levels (`reverb`, `delay`, `radio` chain)
  - simple `filter` / EQ tilt (e.g. high-pass, warm low-pass, telephone/radio band-pass)
  - `lufs` / relative target loudness and `duck` amount (how much a bed yields to a voice)
  - optional piecewise-linear **automation** points anchored to the Block (swells, filter openings, wet-reverb endings).
- Render these natively in the Receiver's Web Audio graph (and equivalently in the Studio's loudness/mixdown pass), with all fields optional so legacy Sessions keep today's exact mix.

**Proof:**
- A whispery verse can sit close, dry, and centered while a wide, reverberant 6-voice choir blooms across the stereo field on the final chorus — declared in the Arrangement, recorded in the Session, and mixed live by the Receiver.

---

### Phase 8 — Generative Arrangement selection and instant WASM audition in Composer
*Packages: `studio`, `composer`, `ui`, `parts`*

**Current ceiling:**
- Plan 21 picks a single static `ARRANGEMENT` via env var, so the eternal Song cannot evolve its own form over time without human intervention.
- The Composer has no audio playback: verifying how an edited Arrangement, Tide curve, or Perspective *sounds* requires syncing to `xitra` and running a full GPU rehearsal.

**Target architecture:**
- **Arrangements in the eternal loop:** give each active Arrangement a `weight`, optional Mood/tempo/character affinity rules, and optional Tide/Perspective compatibility (just like Perspectives), so the Studio can draw an Arrangement deterministically per Song from its wrongness — while `ARRANGEMENT=<id>` remains as a scientist override.
- **Instant client-side audition in Composer:** reuse the Receiver's already-built Chimera WASM throat (`throat.js` + Workers) and Web Audio mixer inside Composer's Edit mode (and Song/Score/Beds/Arrangement benches) to play back:
  - sample words sung through the edited Arrangement, tempo map, key, choir, and mix settings;
  - the hummed two-voice guide (and any Phase 6 WASM instrument Tracks) underneath.
  This runs entirely in the browser with zero GPU, zero `llama-server`, and zero impact on the live Heart — reserving `bun run rehearse` on `xitra` only for auditioning full MusicGen beds.

**Proof:**
- Pressing Play in Composer's Arrangement or Score bench sings the edited timeline in the browser within seconds using the exact Chimera WASM throat; leaving `ARRANGEMENT` unset lets the Studio draw among active Arrangements deterministically and record the chosen id in the Diary and Session.

---

## Suggested sequencing

1. Finish Step 6 of **`plans/2026-11-23-studio-on-timelines.md`** (`tempo-turns` on the air).
2. **Phase 1 (Open Session/Archive)** + **Phase 2 (Track-specific Block parameters)** — highest immediate musical payoff; turns timelines into real orchestration right away.
3. **Phase 3 (Unified parameter tree & open Tides/Perspectives)** — removes the three-way split before more Parts and Tracks multiply the debt.
4. **Phase 4 (Part-owned Lyrics)** + **Phase 5 (Tonic, meter, stanza shape)** — unlocks genuinely new Song forms (waltzes, pre-choruses, key changes, tags).
5. **Phase 8 (Composer WASM audition)** can be pulled forward at any point after Phase 1/2 to dramatically speed up the scientist's design loop.
6. **Phase 6 (Musical anchors, ramps, WASM Tracks)** + **Phase 7 (Declarative choir & FX mix)** + **Phase 8 (Generative Arrangement selection)** — completes the transition from one evolving Song to an open-ended musical instrument meant to run forever.
