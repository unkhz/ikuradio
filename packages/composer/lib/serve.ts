// What the Composer answers: the page, the parts as JSON, the Arrangements as JSON with their layouts. Made from the
// parts and Arrangements the packages find, so a part added as a folder is shown without a line of code changed here.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { firstTune } from 'melody'
import { arrangementsHome, readArrangements, readParts, refuseArrangement, type Arrangement, type PartRecord } from 'parts'
import { layoutOf } from './layout.js'

const publicHome = fileURLToPath(new URL('../public/', import.meta.url))

const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

type Parameter = { name: string; minimum?: number; maximum?: number; default?: number; description?: string }

/** A part's parameters, with their ranges, defaults and words, read from its schema. */
function parametersOf({ part }: PartRecord): Parameter[] {
  const { properties = {} } = part.parameters as { properties?: Record<string, Omit<Parameter, 'name'>> }
  return Object.entries(properties).map(([name, { minimum, maximum, default: given, description }]) => ({
    name,
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
    ...(given !== undefined ? { default: given } : {}),
    ...(description !== undefined ? { description } : {}),
  }))
}

/** The tempo a request asks for: a number from 20 to 300, else the usual 72. */
function tempoOf(url: URL): number {
  const asked = Number(url.searchParams.get('tempo') ?? 72)
  return Number.isFinite(asked) && asked >= 20 && asked <= 300 ? asked : 72
}

/** The Composer's answers, given where its parts and Arrangements live. */
export function composer({ partsHome, arrangementsDir = arrangementsHome }: { partsHome?: string; arrangementsDir?: string } = {}) {
  const json = (value: unknown) => Response.json(value, { headers: { 'cache-control': 'no-cache' } })

  return async function answer(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const records = await readParts(partsHome)

    if (url.pathname === '/parts.json') {
      return json(
        records.map((record) => ({
          id: record.part.id,
          title: record.title,
          text: record.text,
          state: record.state,
          words: record.part.words,
          ending: record.part.ending,
          ...(record.part.beats !== undefined ? { beats: record.part.beats } : {}),
          parameters: parametersOf(record),
        })),
      )
    }

    if (url.pathname === '/arrangements.json') {
      const tempo = tempoOf(url)
      const parts = new Map(records.map(({ part }) => [part.id, part]))
      return json(
        readArrangements(records, arrangementsDir).map(({ arrangement, title, text, state }) => ({
          id: arrangement.id,
          title,
          text,
          state,
          declaration: arrangement,
          layout: layoutOf(arrangement, parts, firstTune, tempo),
        })),
      )
    }

    // the only thing that is asked of a draft, and the only place its rules are kept: the Composer writes no file
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
      const refusal = refuseArrangement(draft, records)
      if (refusal) return json({ refusal })
      const parts = new Map(records.map(({ part }) => [part.id, part]))
      return json({ layout: layoutOf(draft as Arrangement, parts, firstTune, tempoOf(url)) })
    }

    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    if (/^[a-z0-9.-]+$/.test(file) && types[file.slice(file.lastIndexOf('.'))]) {
      try {
        return new Response(readFileSync(join(publicHome, file)), { headers: { 'content-type': types[file.slice(file.lastIndexOf('.'))]! } })
      } catch {
        // not there: not found, below
      }
    }
    return new Response(null, { status: 404 })
  }
}
