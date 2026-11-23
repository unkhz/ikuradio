// What the Composer answers: the map and the concepts' pages, the parts and Arrangements as JSON, and the check of
// a draft. Made from the parts, Arrangements and concepts the packages find and the folders hold, so a part or a
// concept added as a folder is shown without a line of code changed here. The Composer writes no file.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firstTune } from 'melody'
import { arrangementsHome, readParts, readTracks, refuseArrangement, tracksHome, type Arrangement } from 'parts'
import { arrangementsAnswer, partsAnswer } from './answers.js'
import { conceptsHome, readConcepts } from './concepts.js'
import { mapOf } from './map.js'
import { layoutOf } from './layout.js'
import { timelineOf } from './timeline.js'

const publicHome = fileURLToPath(new URL('../public/', import.meta.url))

const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

/** The tempo a request asks for: a number from 20 to 300, else the usual 72. */
function tempoOf(url: URL): number {
  const asked = Number(url.searchParams.get('tempo') ?? 72)
  return Number.isFinite(asked) && asked >= 20 && asked <= 300 ? asked : 72
}

const typeOf = (file: string) => types[file.slice(file.lastIndexOf('.'))]

/** The Composer's answers, given where its parts, Arrangements and concepts live. */
export function composer({ partsHome, arrangementsDir = arrangementsHome, conceptsDir = conceptsHome, tracksDir = tracksHome }: { partsHome?: string; arrangementsDir?: string; conceptsDir?: string; tracksDir?: string } = {}) {
  const json = (value: unknown) => Response.json(value, { headers: { 'cache-control': 'no-cache' } })
  const file = (path: string) => {
    try {
      return new Response(readFileSync(path), { headers: { 'content-type': typeOf(path)!, 'cache-control': 'no-cache' } })
    } catch {
      return new Response(null, { status: 404 })
    }
  }

  return async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url)
    try {
      return await route(request, url)
    } catch (error) {
      // a folder that is not whole is said, loudly, and not hidden
      return new Response(`${(error as Error).message}\n`, { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
  }

  async function route(request: Request, url: URL): Promise<Response> {
    const records = await readParts(partsHome)

    if (url.pathname === '/concepts.json') {
      return json((await readConcepts(conceptsDir)).map(({ id, title, band, leads, line, more, state }) => ({ id, title, band, leads, line, more, state })))
    }

    // where the boxes stand and the arrows run, worked out here and only drawn by the page
    if (url.pathname === '/map.json') return json(mapOf(await readConcepts(conceptsDir)))

    // the Arrangements, as the editor asks for them
    if (url.pathname === '/arrangements.json') return json(await arrangementsAnswer(records, arrangementsDir, tempoOf(url), await readTracks(tracksDir)))

    // the only thing that is asked of a draft, and the only place its rules are kept
    if (url.pathname === '/check') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
      const text = await request.text()
      if (text.length > 1_000_000) return json({ refusal: 'an Arrangement is a small thing; this one is not' })
      let draft: unknown
      try {
        draft = JSON.parse(text)
      } catch (error) {
        return json({ refusal: `that is not JSON: ${(error as Error).message}` })
      }
      const tracks = await readTracks(tracksDir)
      const refusal = refuseArrangement(draft, records, tracks)
      if (refusal) return json({ refusal })
      const parts = new Map(records.map(({ part }) => [part.id, part]))
      const layout = layoutOf(draft as Arrangement, parts, firstTune, tempoOf(url))
      return json({ layout, timeline: timelineOf(draft as Arrangement, layout, tracks, tempoOf(url)) })
    }

    // a concept: its page, its script, and its data
    const concept = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(\.json|\/|\/view\.js)$/.exec(url.pathname)
    if (concept) {
      const [, id, rest] = concept
      const found = (await readConcepts(conceptsDir)).find((candidate) => candidate.id === id)
      if (found) {
        if (rest === '/') return file(join(publicHome, 'concept.html'))
        if (rest === '/view.js') return file(join(found.dir, 'view.js'))
        return json(await found.data({ records, arrangementsDir, tempo: tempoOf(url), query: url.searchParams }))
      }
    }

    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    if (/^[a-z0-9.-]+$/.test(name) && typeOf(name)) return file(join(publicHome, name))
    return new Response(null, { status: 404 })
  }
}
