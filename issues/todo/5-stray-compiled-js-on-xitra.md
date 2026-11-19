---
state: todo
id: 5
kind: issue
slug: stray-compiled-js-on-xitra
---
# xitra's tree holds 183 compiled .js copies that shadow their .ts sources

A bare `tsc` run on xitra (Nov 18, between 19:01 and 20:10) wrote a `.js` and a `.js.map` beside 183 `.ts` sources in `~/Work/song/packages`. The repository's tree has none (commit d1411fc took them out), but the tar sync only adds files, so xitra still has them.

**Why it matters:** Bun, asked for `./guide.js`, loads that literal file and never `guide.ts` beside it (checked in a scratch folder: it printed "from js"). So the next change to any of those 183 sources that is synced to xitra is silently not run: not by the Studio, not by the tests. Today none is stale, since every `.js` is newer than its `.ts`. The first changed file will be.

**What I did:** `packages/tools/lib/stray.test.ts` fails wherever a compiled copy sits beside a source, and names it. It passes on a clean tree, so CI is unaffected. On xitra it fails now, until the files are removed.

**To do, by whoever owns xitra's tree** (I did not remove them: I didn't create them):

```bash
cd ~/Work/song && find packages -path '*/node_modules' -prune -o -name '*.ts' -print \
  | grep -v '\.d\.ts$' | while read f; do rm -f "${f%.ts}.js" "${f%.ts}.js.map"; done
```

That removes only a `.js` or `.js.map` that has a `.ts` of the same name beside it. It leaves `packages/ui/public/*.js` and the built engine files, which have no `.ts` twin. Run `bun test packages/tools/lib/stray.test.ts` after: it should pass.

Until then, sync a changed `.ts` to xitra only after removing its stray `.js`.
