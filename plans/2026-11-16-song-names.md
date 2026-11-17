---
state: active
date: 2026-11-16
owner: scientist
id: 18
kind: plan
slug: song-names
---

# Song Names

A Song is known by its number. The page says `Song 1,234`, and today the link is `/s/1234`. That link is not kept. A Song has a name, and one link, `/s/<id>/<slug>`. The number stays the id. It is not a link.

The mind decides the name, from the Song's weather and its lyrics. The weather is the Mood's descriptions, `session.mood`. The name is stored on the Session, punctuation and all. Periods, hyphens, quotes, commas, apostrophes and question marks may be in the title. The slug is made from the name by one function, and it is not the title. Marks that are not letters, digits or hyphens are removed, and an apostrophe is removed without leaving a space, so `Song's` becomes `Songs`. What remains is lowercase, and the spaces become single hyphens. Prefix and suffix hyphens are removed, duplicate sequential hyphens are replaced with single hyphen. `Death-machine, the Song's 2nd birth?` is a title. Its slug is `death-machine-the-songs-2nd-birth`. Uniqueness is the slug, not the written title. Two titles that make the same slug are the same name.

Every Song already in the Archive is named before the numeric link is removed. The same logic, from the weather and the lyrics it already has. After this, no Song has only an id. The migration is also the test: more than 700 names, read to see that the logic produces sensible ones.

## How the name is chosen

The mind is asked for a title. The logic, in this order:

1. It is a short title that poetically captures what the lyrics convey. A shorter title is preferred to a longer one.
2. If that slug is already used, a qualifier is added. It is sought with the same poetic aim, and it may be as long as it needs to be. There is no maximum word count. `hollow death` may become `hollow death by boredom`. If no qualifier is found, the title is asked for again from the start. A unique slug is always found. A Song is not published without one.
3. Two words at least. A single word is a statement, and only for a Song that has become very dear to the mind during the writing. The mind is told so. The plan does not score that dearness.

The slug is checked against the slugs already kept with the Songs. How that list is read, short of opening every Session, is open.

## The intro

The name is part of the speech a DJ uses to introduce the Song ([Intro with Rezzy](2026-11-16-intro-with-rezzy.md)). It is decided before that speech is written, and the mind is shown it. The speech belongs to the DJ. The name belongs to the Song.

## Where it is shown

The Songs list the knob opens, `songRow` in `packages/ui/public/index.js`, shows the name as well as the number. That list is what the dial opens. Every row is a link, `/s/<id>/<slug>`. The number is not a link.

The bottom row, `#status`, is `Song N · iteration M`. The name is written after the iteration.

## The link

The only link is `https://ikurad.io/s/<id>/<slug>`, as `https://ikurad.io/s/748643/hollow-death-by-boredom`. There is no other. `/s/<id>` is not a route, not a redirect, and not a way to find a Song. A slug that is not the Song's is not the link either. The Radio does not say whether the number is a Song. A missing slug and a wrong slug are not found, the same as any other path that is not the link. A short link that answered, even by sending the visitor on, would be copied onto pages the project does not control, and the Song would be split.

The Radio serves a sitemap of these links only. There is no sitemap today, so the path of that file is open. Every Song is in it.

The project uses only this link: the Songs list, `carryOnTo`, the page's social tags, and any promotional material. `replayAt` today accepts `/s/<n>`. It accepts only `/s/<id>/<slug>`, and only when the slug is the Song's. The route in `packages/radio/index.ts` that serves `/s/<n>` is removed, not turned into a redirect.

## What stays

- The id is not a link. A name is not a second id.
- After this, every Song has a name, including those that were already in the Archive. `/s/<id>` is not left in place for them.
- The thought stays the thought. The name is not it.

## What moves

- `archive`: a name on every Session. The Songs already archived are migrated, not left without one.
- `song`: the mind is asked for the name, with the rules above, before the intro speech.
- `studio`: keeps the name, and tells it to the mind when the intro speech is written.
- `radio`: the only Song path is `/s/<id>/<slug>`, and only when the slug is the Song's. `/s/<id>` is not served and not redirected. A wrong slug is not found. The sitemap lists only these links. The social tags use this link.
- `ui`: the name in the Songs list, and in `#status` after the iteration. Every link is `/s/<id>/<slug>`.

## Order of work

1. The name on the Session, and the one function that makes the slug.
2. The mind's instruction, and the check that the slug is not already used. No maximum length. A unique slug is always found.
3. The Songs already in the Archive are named, and the names are read.
4. The Radio's only Song path, and the sitemap of those paths only. The `/s/<id>` route is removed only after every Song has a link.
5. The Songs list and the bottom row.
6. The intro speech is shown the name, and says it.

## Done when

- Every Song has a name on its Session, a unique slug, and one link, `/s/<id>/<slug>`. The Songs that were already archived have them too.
- `/s/<id>` is not found, and does not say whether the number is a Song. A wrong slug is not found. Nothing redirects to the link.
- The Songs list and the bottom row show the name. The bottom row shows it after the iteration. Every row links to `/s/<id>/<slug>`.
- Every link the page makes to a Song is `/s/<id>/<slug>`.
- The intro speech says the name.
- The sitemap lists every Song, and only by that link.
