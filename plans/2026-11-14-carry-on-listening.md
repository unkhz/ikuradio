---
date: 2026-11-14
state: active
owner: scientist
id: 12
kind: plan
slug: carry-on-listening
---
# Carry on listening

A Song heard again at `/s/<n>` ends with *~ Song N has ended ~* and a hint to tune to live
from the knob. Then nothing. Someone who came for one Song and liked it has to find the
next one by hand. It should be easy to carry on: to the next Song, and the next, or back to
live.

## What changes

1. **Two buttons where a Song ends.** After *~ Song N has ended ~*, the page shows two
   buttons in place of the hint:
   - **autoplay next** turns autoplay on and carries on with the next Song in order;
   - **tune live** carries on with the live song.
2. **Autoplay carries on by itself.** While autoplay is on, a Song that ends is followed by
   the next Song in order, without a button. The next Song is the next one that has aired,
   in the Radio's order. Songs that were never published are skipped, as the Songs list
   skips them. When the next Song is the one playing live, autoplay tunes to live.
3. **Autoplay is remembered.** It is kept in the browser (localStorage, read and written
   safely), so it stays on for the next visit, until it is turned off.
4. **A toggle behind the knob.** The knob's panel has an autoplay toggle that can be
   flipped at any time. It is shown only while hearing a Song again. Tuned to live, it is
   hidden, because live always carries on.
5. **Carrying on never reloads the page.** Browsers allow sound only after a click on the
   page, and a reload loses that permission. So the next Song, or live, is taken up within
   the same page: the Song is fetched and played on the same AudioContext, and the address
   becomes `/s/<next>` (or `/`) with `history.pushState`, so the address bar, back button
   and sharing still name what is playing. Only the very first *switch on* of a visit needs
   a click.

## What stays as it is

- Live (`/`) works as now. Autoplay changes only what happens after a Song heard again.
- A Song not yet aired still can't be heard early. Autoplay never goes past live.

## Done when

- At the end of a Song heard again, **autoplay next** plays the next aired Song in the
  same page, with no reload and no second click, and the address shows its `/s/<n>`.
- With autoplay on, Songs follow one another until live, and then the page is live.
- **tune live** takes up live in the same page, and the address becomes `/`.
- The knob's toggle shows the current state, flips it, is remembered across visits, and is
  hidden when live.
- The browser's back button returns to the previous Song's address.
