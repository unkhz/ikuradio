---
state: active
date: 2026-11-16
owner: scientist
id: 16
kind: plan
slug: intro-with-rezzy
---

# Intro with Rezzy

Rezzy lives on the page, and pops up to introduce a Song. That introduction is played only when someone comes to the Song's page, `/s/<id>/<slug>`. It is not played when the page carries on by itself, and not on `/`, whether the mode is `live` or an encore is being aired.

## The intro

Every Song made from here has a new part, `intro`. It has a music recording, composed to connect to the first verse. It is the length of a bridge: four bars, as `packages/melody/lib/bridge.ts` builds one. A bridge connects two parts. An intro connects from nothing to a part, the first verse of the Song. It is played once, at the beginning, not before every iteration.

`SessionPart` is `verse`, `chorus` or `bridge`. Intro is added to that. A bridge has no words. The intro's music has none of the Song's lines either. The speech is not written into the part.

Songs already in the Archive have no intro. A page for one of those plays as it does now.

## The DJ

Rezzy is not part of the Song. Rezzy is a DJ. DJs live in `packages/dj`, loaded once, not once a Song. There can be more than one. The first, and the only one built here, is Rezzy. Each DJ has their own properties in that package: voice settings for the throat, and how their movements are read. Those belong to the DJ, are the same for every Song, and are not written into the Archive. Rezzy's voice is chosen by ear, once.

A DJ speaks when and only if the Song is playing the intro. They time the speech so it fits those four bars. The speech is prewritten by the mind, one a Song for that DJ, and kept in the Archive. It belongs to the DJ, not the Song. The Session does not hold it.

Each DJ has their own declaration per Song, beside the Session. Rezzy's is `dj-rezzy-<song>.json`, as `dj-rezzy-123.json` for Song 123. A later DJ would have their own, as `dj-wanda-<song>.json`, and is not built here. `paths` in `packages/archive/lib/session.ts` gains a path per DJ, beside `session`. A declaration holds only what that DJ says or does in that Song, per part. Initially the only part in Rezzy's is the intro, and the only thing in it is the speech.

The speech is timed the way a voice is timed now: a take, notes and words, as the throat is given them. It lives in the declaration, not among the Song's recordings. The DJ's movements are timed to that speech. While the intro plays and there is a speech, Rezzy is drawn, and moves with it. When the intro ends, Rezzy is put away. Otherwise Rezzy is in the page's code and not drawn.

If the mind writes no speech, the Song still has its intro, and Rezzy does not come out.

## What stays

- The page at `/` plays no intro, whether the mode is `live` or `encore`. Rezzy is not drawn.
- Autoplay does not play the intro. `carryOn` and `carryOnTo` in `packages/ui/public/index.js` take up the next Song from its beginning. That path skips the intro, even though the address becomes the Song's link, `/s/<id>/<slug>`. The address alone cannot tell a visit that opened there from a carry-on.
- The thought stays on the Session, read, not spoken.
- Verse, chorus and bridge are unchanged. The intro is not a bridge with nothing to leave. `bridgeForm` needs a part before it.

## What moves

- `archive`: `intro` on `SessionPart`. A path per DJ, `dj-<name>-<song>.json`. Rezzy's is the only one written. The declaration is not inside the Session, and does not hold the DJ's voice or movements.
- `melody`: the intro, four bars, from nothing into the first verse.
- `studio`: composes the intro into the Song, asks the mind for Rezzy's speech, and writes Rezzy's declaration to the Archive.
- `song`: the mind writes the speech, one a Song, for Rezzy to say. It is not the thought.
- `dj`: the package, loaded once. Each DJ's properties live here: voice, and how movements are read. Rezzy's are the only ones built. Speaks only during the intro, and times the speech to it.
- `ui`: a visit that opened the Song's page, `/s/<id>/<slug>`, plays the intro, then the Song, and draws Rezzy only while that intro plays and a speech is there. A carry-on, and `/`, do not.

## Order of work

1. Rezzy's voice settings, heard once.
2. The intro part: four bars, from nothing into the first verse, on the Session.
3. `packages/dj`, loaded once. Each DJ's properties live there. A declaration per DJ per Song is kept in the Archive. Rezzy's is the only one written.
4. The mind writes Rezzy's speech. The Studio keeps it in Rezzy's declaration, timed to the intro as a take. The voice and the movements stay in the package.
5. The page tells a direct visit from a carry-on. The intro plays only on the visit. Rezzy is drawn only while it plays and a speech is there. `/` does not play it, in either mode.

## Done when

- Opening the Song's page, `/s/<id>/<slug>`, for a Song that has an intro plays the intro, then the Song. Rezzy speaks during the intro, moves with the speech, and is not drawn after.
- Carrying on into that Song does not play the intro, and Rezzy stays unseen.
- The page at `/` does not play an intro, and Rezzy stays unseen, including while an encore is being aired.
- The speech is in `dj-rezzy-<song>.json`, not in the Session, and not in the package. Rezzy's voice and movements are in `packages/dj`.
- A Song from before this has no intro and no declaration, and its page is as it was.
- `packages/dj` is loaded once, not once a Song. Another DJ would be another set of properties there, and another declaration per Song, and is not built here.
