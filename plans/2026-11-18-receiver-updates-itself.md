---
state: active
date: 2026-11-18
owner: scientist
id: 19
kind: plan
slug: receiver-updates-itself
---
# The Receiver updates itself

A Receiver is the page it was given: `index.html` and the files it names, all of `packages/ui/public/`, carried inside the Radio and handed out from `pageFiles` in `packages/radio/index.ts`. Once a browser holds them, it asks the Radio only for the Tactus, every five seconds, and fetches each Song's Session and Recordings from the Archive. A page of this song stays open for weeks. And the Radio beneath it is re-released often: whenever the CI builds a new image from a new git hash and tunes the cluster to it. Nothing tells an open page. It goes on with the files it was given until it is closed; only a fresh visit gets the fresh page.

The Tactus will tell it. The answer the page already asks for will carry two versions, and a page that sees either one move will bring itself up to date, at the one moment the song can spare: the end of the Song it is playing.

## The versions

The Radio's release is the git hash the CI builds it from — the hash that tags the image in `.github/workflows/radio.yaml` and is written into `.khz-k3s` for the cluster to tune to. That versioning stays as it is; this plan only surfaces it. The hash is baked in at build: the workflow passes it into the Dockerfile, and its `bun build` defines it into the executable. `/tactus` tells it as `release`.

The Archive gets a version too, told beside it as `archiveVersion`. The Archive has none today, and its files are not hashed and will not be: one version for the whole Archive, and when it changes, anything in it may have changed. What makes it is open. A small stamp the Studio writes whenever it puts anything in is the sure way. The index the Radio already reads in `listen()` would catch new Songs, but would not notice a file shelved afresh. Whichever it is, the Radio reads it and the Tactus tells it, and nothing else about the Archive changes.

The versionings that already exist stay exactly as they are: each Session keeps its `version`, which the Radio already checks in `playable()` before it announces a Song; the throat keeps its `<revision>+<patch>`; the image tags and the cluster's `newTag` keep their meaning. The two new fields are additions, not replacements.

## The Receiver's files, hashed

An update reloads the page, and a reload ordinarily refetches everything. It should not: a file that did not change should not be asked for again. So the Receiver's files are minified and named with a hash of their contents at build: `index.js` becomes `index.<hash>.js`, and so for every file the page is served from. The index is rewritten to name the hashed files, and so is every other place that names a file by hand, including the worker the page opens by path. A file that changed gets a new name and is fetched; a file that did not keeps its name, and the browser already holds it. Hashed files are sent `immutable`, kept as long as the browser likes, in place of today's mix of `no-cache` and a day's `max-age`. The index is the exception: it stays `no-cache`, the one file always revalidated, because it is how new names are learned.

The build belongs to the Receiver, for the files are the Receiver's: a script in `packages/ui`, beside the `verses` build the root `package.json` already runs. The Dockerfile runs it before `bun build packages/radio/index.ts` compiles the Radio, so the executable is built with the hashed files inside it, and wherever the Radio is built, the Receiver is built first. The Radio's `pageFiles` — today imported by hand from `../ui/public/*` — comes instead from a manifest the build writes, listing each hashed file and its type. The same build stamps the release into the page, so a page knows the release it is running, and feeds the page the names it asks for by hand. The manifest's exact shape, and the place the build writes to, are open; the order is not.

## The update

Every ask of the Tactus is answered with the versions, and the page compares them with what it is running. Live, the page already asks every five seconds in `listenLive`; hearing a Song again, it asks only at the beginning today, and will ask while it is open, the same five seconds, for this is the thread the update hangs from.

1. Nothing changed: the page goes on, as now.
2. The Radio's `release` differs from the release the page was built with: a Radio update is queued, and prepared — while the Song plays, the new index is fetched quietly and the files it names with it, so what changed is already here when the reload comes.
3. The Archive's `archiveVersion` differs from the last one seen: an Archive update is queued. There is nothing to prepare; it is a letting-go.

Then the page waits for the Song to have stopped. It knows the ending already, from the airing's `begins` and `seconds`, whether the Song is live or heard again. If no Song is playing when the versions are seen, the update is taken at once. A Song is never interrupted; that is the point of waiting.

Nor is the next Song started while an update is queued: nothing new is begun until the update procedure is done. Live, the next Song's beginning is usually the very moment the last one ends; the page lets that moment pass, takes the update, and then joins the next Song from wherever it has reached, as any late arrival is. Carrying on, hearing Songs again, waits the same way.

At the stopping, in order:

- **Archive update queued.** The page lets go of what it holds from the Archive, minimally. The Song that just stopped played itself out on what it had. What has never been heard — the next Song, prepared ahead — is dropped from `songs`, so that the next Song is fetched afresh, its Session and Recordings read again from the Archive. Ended Songs are let go already, by `forget()`. The page does not re-check a Session's `version`; the Radio checked it when it announced the Song, and that stays as it is.
- **Radio update queued.** The page reloads. The reload fetches the index without cache — it is `no-cache`, always asked for — and with it only the files whose hashes changed. That is the invalidation of the Radio's and the Receiver's assets, and it is minimal by the same naming: the old names are simply not asked for again, and what the browser holds under them expires on its own. After the reload the page is as a first visit: sound waits for its one click, as it does after any reload, and autoplay is still on if it was on, for it is kept in the browser.

When both are queued, the letting-go comes first and the reload follows; after a reload everything is fetched afresh anyway, so the letting-go matters only when no reload follows. Where the reload lands, on a page hearing a Song again, is open: in place, at the link it is on, which would play that Song from its beginning — or tuned to the index at `/`.

## What stays

- A playing Song is never cut short by an update. It ends, the update follows, and no next Song is begun until the update is done.
- The existing versionings are untouched: `sessionVersion` and each Session's `version`, the throat's `<revision>+<patch>`, the CI's sha tags and the cluster's `newTag`. The Heart and the CLI read `/tactus` today and are unchanged; they ignore the new fields.
- The Archive is not hashed, and nothing is written into it beyond its version, whatever that turns out to be.
- Autoplay, the knob, the Songs dialog, the page's whole working: unchanged. The update adds one decision at the end of a Song.

## What moves

- `radio`: bakes its release in at build, reads the Archive's version, and tells both in `/tactus`; serves the Receiver's files from the build's manifest instead of the hand-imported `pageFiles`, hashed files `immutable` and the index still `no-cache`; the meta it writes into a page — the card a shared link names — carries the hashed names.
- `ui`, the Receiver: gains the build (minify, hash, manifest, stamp the release) and the page's half of the update — compare, queue, prepare, wait for the Song to stop, let go, reload.
- The CI, `radio.yaml` and the Dockerfile: builds the Receiver before the Radio, and passes the sha it builds from into the image. The workflow's `paths` already watch `packages/ui/**`; that stays.
- The Archive's version, wherever it lives: if the Studio writes a stamp, `archive` and `studio` move a little; if the Radio derives it, only `radio` moves.

## Order of work

1. The Tactus tells the versions: the Radio bakes in its release and reads the Archive's, and `/tactus` carries both. What makes the Archive's version is decided here.
2. The Receiver's build: minify and hash the files of `packages/ui/public/`, write the manifest, stamp the release. The Dockerfile runs it before the Radio's build, and the Radio serves by it.
3. The page's half: compare on each ask, queue, prepare, wait for the Song to stop, let go of the never-heard, reload; and the next Song is begun only after all of it is done.

## Done when

- A page open on an old release, playing a Song, plays it to its end, then reloads, and the page it lands on is the new release. Only the files whose hashes changed were fetched; the rest were served from the browser's cache without asking.
- An update queued at a Song's ending holds the next Song back: it is not started until the update procedure is done, and is then joined from wherever it has reached. Carrying on waits the same way.
- A page with no Song playing takes the update at once.
- With only the Archive's version changed, nothing reloads. The Song playing plays on, and the next Song's Session and Recordings are fetched afresh.
- With neither version changed, a page goes on exactly as now.
- The release the Tactus tells is the git hash the running Radio was built from.
- After the reload, autoplay is still on if it was on, and sound waits for the page's one click.
- The Heart and the CLI, and every other reader of `/tactus`, go on working.
