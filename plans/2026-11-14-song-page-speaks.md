---
date: 2026-11-14
state: active
owner: scientist
id: 11
kind: plan
slug: song-page-speaks
---
# A Song's page says what it is

A Song's page, `/s/<n>`, is a single page whose one button switches the receiver on. Nothing
on it links to the Song's sound, so a crawler that reads it gets only what the page says
about the Song, and the heavy downloads stay with people who press the button. That is as
it should be. But today the page says almost nothing: what the knob's panel shows (the
weather, the key, the choir, the band, how the Song is heard, the mind's thought) is filled
in by the page's script only once the Song plays. A person sees an empty panel until then,
and a crawler never sees it at all.

So the Radio writes the panel into the page it serves.

## What changes

1. **The Radio renders the panel for `/s/<n>`.** `page()` in `packages/radio/index.ts`
   already reads the Song's Session when the Song has aired, for the social description.
   From the same Session it writes `#details` (and `#thought`, if the Session has a
   thought) into the served HTML, with the same `dt`/`dd` rows the page's `tellDetails()`
   writes:
   - song: the Song's number
   - weather: the Mood's descriptions
   - key: the mode and tempo
   - choir
   - band, if the Session has a sound
   - heard: the Perspectives, if any
   - length: the Song's minutes, and its iterations, first to last

   Everything is escaped, as the social tags already are.
2. **Only what has aired.** A Song not yet received gets no details, exactly as its social
   description does today: nothing from the future.
3. **The page keeps what it was given.** The panel's script must not wipe the served rows
   before the Song plays. Until something is being received, `tellDetails()` leaves the
   served details as they are; once the Song plays, it takes over as now, adding the
   iteration as it goes.
4. **Structured data for crawlers.** The same page carries a small JSON-LD block
   (schema.org `MusicRecording`): the Song's name, its duration, its weather as keywords,
   and ikuradio as the one who made it. Search engines read this even where they discount
   hidden text.
5. **Sessions never change once published,** so the Radio may keep the last few hundred it
   has read in memory, to answer a page without asking the Archive again.

## What stays as it is

- The Songs list behind the knob (search, paging) stays client-side and is not rendered
  into the page.
- The root page, `/`, the live receiver, is unchanged here.
- Nothing links to the Song's sound. The Session's address may appear only where the page
  already uses it at play time, never as a link.

## Done when

- `/s/<n>` for an aired Song serves the panel's details and the thought in its HTML, and
  its JSON-LD, all escaped. A test covers it, with a Session whose words need escaping.
- `/s/<n>` for a Song not yet aired serves no details.
- Opening a Song's page shows the panel filled before *switch on*, and playing it still
  fills the panel as now.
