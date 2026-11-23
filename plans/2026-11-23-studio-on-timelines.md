---
owner: robot
date: 2026-11-23
state: active
id: 21
kind: plan
slug: studio-on-timelines
---

# The Studio on timelines

The scientist chose this as the next piece of "Evolution of Song" (step 16 there). There, the Song became an Arrangement with a timeline: regions, Tracks, Blocks with keys, a tempo map and turns. Those Arrangements are drawn and edited in the composer. The Studio doesn't read them yet. It still makes every Song by today's rules, in code:

- `arrange()` in `song`;
- `ITERATION_COUNT` passes;
- a bed for each kind of section, with a 3 s tail;
- every line laid end to end.

This plan makes the Studio read the Arrangement and make what its timeline says. The first proof is that it changes nothing: for `the-song`, every Song is made and placed exactly as it is now. Only once that holds does a second Arrangement go on the air, and only when the scientist says so.

## What the Studio does now, and where the timeline meets it

- **The passes.** `composer` writes one iteration at a time, and a Song lasts `ITERATION_COUNT` of them (env, 2). Each iteration has its own `Lyrics` (`firstVerse`, `secondVerse`, `thirdVerse`, `chorus`, `finalChorus`), placed by `arrange()`. In the timeline, a pass is what lies between two turns, and the Song's iterations are the turns and one.
- **The voices.** `perform` fits and sings each line once, by its key, then lays every line end to end: a line's `at` is the sum of the seconds before it, and a bridge lasts its own seconds. So a region lasts what was sung, not what the first tune's beats say. In the timeline that is a measured length: a region's seconds come from its lines.
- **The guides and the beds.** `humGuides` hums a guide for each section, and `underlay` grows a bed for each guide, or plays one from the `Shelf`. Each bed is `tail` (3 s) longer than its section, at `bedGain`, fading out over its tail. In the timeline these are the `guide` and `bed` Tracks' Blocks. In `the-song` there is a voice, a guide and a bed under every region, keyed by the region's name and pass (`voice|guide|bed:<name>[:2]`), so the chorus's two sections share theirs, as they share their words. A bed runs to its region's end plus 3 s. The Sessions on the air show this: Songs 1855 to 1867 each have 20 guides and 20 bed placings, about 15 of them distinct, because the chorus shares and the Shelf plays a few again. Step 9 of "Evolution of Song" had first keyed the beds and guides by kind, after the Studio's older rules; that was corrected here (2026-11-23).
- **The Session.** `toSession` writes every recording at its moment (`at`, `seconds`, `gain`, `fade`), every part at its moment, and the iterations end to end. The Receiver already plays recordings where the Session puts them. Mixing the timeline is therefore writing the Session from the timeline: no new mixer, and no new reader for anything the Session already says.
- **What the Session can't say yet:**
  - a fade in (`fade` is the fade out only);
  - a tempo that changes within a Song (`tempo` is the Song's one tempo);
  - a part that isn't a verse, chorus or bridge (`type` is a closed union).

  Each of these comes as an addition to the Session and its readers, at the step that needs it, not before.

## The rules this plan keeps

- **Song for Song identical.** Until step 6, nothing that goes on the air changes. The proof is placement, not sound: given the same made lines, guides and beds, the timeline's Session is exactly the Session `toSession` writes today, recording for recording, in the same order.
- **The Archive is for ever.** A Session written wrongly can't be taken back. So the Studio first makes the timeline's Session in the shadow of the real one, beside it and unpublished, and says where they differ. It is switched over only once real Songs on the air have shown no difference.
- **Words by name.** An Arrangement's names get the words that the same names have in `the-song`, as `fieldsOf` gives them in the composer. A name `the-song` doesn't have is refused by the Studio, plainly, until a plan of its own lets an Arrangement give a new name its own words.
- **Readers by addition.** The Session gains fields; it never changes what an existing field means. A Session from before this plan still plays.
- **One Arrangement to a Song.** It is chosen when the Song begins, written into the diary's page for that Song, and kept until the Song ends, so a Studio that falls and wakes again goes on with the same one.

## Steps

1. **Measured timelines** (`packages/parts`).
   - `resolve` takes measured seconds for any region (`Lengths.seconds`), which stand instead of beats at a tempo. A region that was sung lasts what it was sung for.
   - `makingsOf(resolved, tracks)`: what a timeline asks to be made, and where it goes. Each distinct key on each Track is made once: its source region or regions, its length (the longest of its placings), and every place it is played (at, seconds, gain, fades).
   - Proof:
     - unit tests on `the-song` and `tempo-turns`, measured and unmeasured;
     - `the-song` asks for, per pass, one voice, one guide and one bed key per name: a region and its repeats share them, as the Studio makes them today, a guide for every section and a bed from every guide.
2. **The Session from the timeline, in the shadow** (`packages/studio`).
   - `sessionOf(arrangement, made, ...)` writes a Session from the timeline: the regions measured from the sung lines, the Blocks resolved, and each recording placed where its Block says.
   - The Studio keeps publishing `toSession`'s Session. It also makes `sessionOf`'s, compares the two, and logs every difference with its path ("recordings[14].at: 43.3 ≠ 43.4"). It never publishes the shadow.
   - Proof:
     - with the fixtures in `studio/lib/fixtures`, and with made iterations drawn from three Sessions now in the Archive (read, never written), `sessionOf` equals `toSession` deep and in order;
     - then N real Songs made on the air with no difference in the log. N is 10, checked in the Studio's logs on xitra and against the Sessions on ikurad.io.
3. **The Arrangement sets the Song's length.**
   - The Song's iterations are its Arrangement's turns and one.
   - `ARRANGEMENT` (env, default `the-song`) names the Arrangement a new Song takes. The Studio reads it with `readArrangements` and refuses it, before the mind is woken, if:
     - it doesn't pass `refuseArrangement` and `refuseTimeline`;
     - it has a name `the-song` lacks;
     - it needs something this plan hasn't reached yet (a step says which).
   - `ITERATION_COUNT` goes, in the same commit, from the env, `rehearse.ts` and the docs. A diary page written before this has no Arrangement and is read as `the-song`.
   - Proof: the Song's place (`began`, `lasts`) for `the-song` is what `ITERATION_COUNT=2` gave, across a Song's boundary and after a Studio wakes mid-Song. The shadow stays silent.
4. **Making each distinct Block once.**
   - `perform`, `humGuides` and `underlay` are asked for what `makingsOf` lists, instead of walking `arrange()`:
     - a voice key is sung once, line by line, as now;
     - a guide is hummed for its source region;
     - a bed key is grown once, from its source's guide, as long as its longest placing (its tail is in the Block, not added by `underlay`), or taken from the `Shelf` by today's rules;
     - a bed key placed twice is one recording, placed twice.
   - For `the-song` the keys are today's kinds, so the shelf's choices and the `bridge:<from>><to>` kinds stay the same.
   - Proof: the shadow stays silent for N more Songs. The number of beds grown per Song is unchanged, compared with the 20 Songs before this step, as the Studio's log says.
5. **The switch.**
   - The Studio publishes `sessionOf`'s Session.
   - `toSession`'s placing, `arrange()` in the Studio and the shadow go.
   - `the-song` is now how the Song is made, not a copy of the code beside it.
   - Proof:
     - `bun run test`;
     - the next three Songs on ikurad.io play through on a Receiver, checked as a listener would: the voices, the beds under them, the bridges;
     - their Sessions match the shape of the ones before.
6. **A second Arrangement on the air**, when the scientist chooses one.
   - `tempo-turns` needs the Session's additions and their readers:
     - each part's own tempo (`parts[].tempo`, where it differs from the Song's), followed by the Tactus and the Receiver's beat;
     - free time (`tempo: null`) for a part, where the Receiver shows no beat;
     - a Block's fade in (`fadeIn`), played by the Receiver;
     - the Studio singing, humming and growing a part at its own tempo: the Score's bpm, MusicGen's prompt, the guide's bpm.
   - A key is one recording, so it is made at one tempo. In `tempo-turns`, the chorus heard at 96 bpm can't share its key with the chorus at 72. Its Blocks get keys of their own (e.g. `voice:chorus:96`), and the Studio refuses a key whose placings lie under different tempi.
- The Receiver gets them as its page updates itself (the plan "The Receiver updates itself"). A Receiver that doesn't know them yet plays the Session as before, at the Song's tempo, with only its fades out.
   - The Studio refuses an Arrangement whose needs aren't met yet (step 3), so `ARRANGEMENT=tempo-turns` can't be set before this step is done.
   - Proof:
     - a rehearsal on xitra of one `tempo-turns` Song (never while the Heart is live: they share the mind's port);
     - its Session drawn in the composer's Song bench next to the Arrangement, with the same seconds;
     - the scientist's ear.

     Then it goes on the air when the scientist sets `ARRANGEMENT`.

## How the work is done

As in "Evolution of Song":
- The work loop builds the plan one step at a time.
- The Composer session (`local_fc37e40e-0716-4eb8-8cf6-bb6cf79eca3d`) reviews each push before the next step.
- Steps 2 to 5 touch the Studio that makes the Songs on the air. Each is deployed to xitra only as the loop already deploys the Studio, and checked on ikurad.io before it is called done.

## Not in this plan

- Words for names `the-song` doesn't have (each name its own `Lyrics` field, which the mind writes).
- Opening the Archive's readers to part ids other than verse, chorus and bridge.
- The Intro as a part.
- A maker for a Track that plays the whole Song.
- Tempo ramps.
- Words in free time.
- Playing a test Song from the composer.

These are in "Evolution of Song"'s Still open and step 16, each to be planned when chosen.
