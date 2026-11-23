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
import { formatArrangement } from './format.js'
import { layoutOf } from './layout.js'
import { blockParametersOf, timelineOf } from './timeline.js'
import { perspectiveChecked, perspectiveText, tideChecked, tideTexts } from './files.js'
import { measureOf } from './measure.js'
import { whereOf } from './where.js'

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

  /** A body that is JSON and not large: its value, or the refusal to say. */
  async function postedJson(request: Request): Promise<{ value: unknown } | { refusal: string }> {
    const text = await request.text()
    if (text.length > 1_000_000) return { refusal: 'a file is a small thing; this one is not' }
    try {
      return { value: JSON.parse(text) }
    } catch (error) {
      return { refusal: `that is not JSON: ${(error as Error).message}` }
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
      return json((await readConcepts(conceptsDir)).map(({ id, title, band, edits, leads, line, more, scripts, state }) => ({ id, title, band, edits, leads, line, more, scripts, state })))
    }

    // where the boxes stand and the arrows run, worked out here and only drawn by the page
    if (url.pathname === '/map.json') return json(mapOf(await readConcepts(conceptsDir)))

    // the Arrangements, as the editor asks for them
    if (url.pathname === '/arrangements.json') return json(await arrangementsAnswer(records, arrangementsDir, tempoOf(url), await readTracks(tracksDir)))

    // the Tracks there are, with what makes them: the editor offers them and names none
    if (url.pathname === '/tracks.json') {
      return json((await readTracks(tracksDir)).filter(({ state }) => state === 'active').map(({ track, title }) => ({ id: track.id, title, heard: track.heard, makes: track.makes ?? null, parameters: blockParametersOf(track) })))
    }

    // what a part counts of its lines, for the parameters an instance gives it
    if (url.pathname === '/measure') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
      const asked = await postedJson(request)
      if ('refusal' in asked) return json(asked)
      const { part, parameters } = asked.value as { part?: unknown; parameters?: unknown }
      return json(measureOf(records, part, parameters, tempoOf(url)))
    }

    // the files of Perspectives and Tides: checked by their own packages, written as they are written, and what an edit would do
    const filesRoute = /^\/(perspective|tide)\/(check|format)$/.exec(url.pathname)
    if (filesRoute) {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
      const asked = await postedJson(request)
      if ('refusal' in asked) return json(asked)
      const [, kind, what] = filesRoute
      if (kind === 'perspective') return json(what === 'check' ? await perspectiveChecked(asked.value as never) : await perspectiveText(asked.value as never))
      const song = Math.max(1, Math.floor(Number(url.searchParams.get('song') ?? 1)) || 1)
      return json(what === 'check' ? await tideChecked(asked.value as never, song) : await tideTexts(asked.value as never))
    }

    // a draft as the file it would be saved as, if it is accepted: the one place a file's text is made
    if (url.pathname === '/format') {
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } })
      const text = await request.text()
      if (text.length > 1_000_000) return json({ refusal: 'an Arrangement is a small thing; this one is not' })
      let draft: unknown
      try {
        draft = JSON.parse(text)
      } catch (error) {
        return json({ refusal: `that is not JSON: ${(error as Error).message}` })
      }
      const refusal = refuseArrangement(draft, records, await readTracks(tracksDir))
      return refusal ? json({ refusal }) : json({ text: formatArrangement(draft as Record<string, unknown>) })
    }

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
      if (refusal) return json({ refusal, where: whereOf(refusal) ?? null })
      const parts = new Map(records.map(({ part }) => [part.id, part]))
      const layout = layoutOf(draft as Arrangement, parts, firstTune, tempoOf(url))
      return json({ layout, timeline: timelineOf(draft as Arrangement, layout, tracks, tempoOf(url)) })
    }

    // a concept: its page, its script, and its data
    const concept = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(\.json|\/|\/[a-z0-9-]+\.js)$/.exec(url.pathname)
    if (concept) {
      const [, id, rest] = concept
      const found = (await readConcepts(conceptsDir)).find((candidate) => candidate.id === id)
      if (found) {
        if (rest === '/') return file(join(publicHome, 'concept.html'))
        // the scripts of a concept's own folder: its view (Learn), its edit (Edit), and what they share
        if (rest.endsWith('.js')) return file(join(found.dir, rest.slice(1)))
        return json(await found.data({ records, arrangementsDir, tempo: tempoOf(url), query: url.searchParams }))
      }
    }

    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    if (/^[a-z0-9.-]+$/.test(name) && typeOf(name)) return file(join(publicHome, name))
    return new Response(null, { status: 404 })
  }
}
