// The timeline of an Arrangement as the Composer says it (plan "Evolution of Song", step 10): its regions, its tempo, its turns
// and the Blocks on its Tracks, resolved to seconds by the parts package's `resolve` and given to the page as plain numbers, so the
// page draws and works nothing out. A refused Arrangement never reaches here; one that cannot be resolved is said, not drawn.

import { resolve, type Arrangement, type Resolved, type TrackRecord } from 'parts'
import type { Layout } from './layout.js'

/** How many beats a bar has, for the bars drawn where there is a tempo. */
export const beatsPerBar = 4

/** A Track as the page needs it: what it is called, whether it is heard, and what makes its Blocks, or nothing yet. */
export type TrackAnswer = { id: string; title: string; heard: boolean; makes: { by: string; from: string } | null }

/** A stretch under one tempo, or in free time (`tempo` null), from and to seconds. */
export type Segment = { tempo: number | null; from: number; to: number }

export type TimelineAnswer =
  | { refusal: string }
  | (Resolved & { beatsPerBar: number; segments: Segment[]; turns: { seconds: number; iteration: number }[]; tracks: TrackAnswer[] })

/** The Arrangement's timeline, resolved at the layout's lengths in beats and a Mood's tempo. The tracks are those the Arrangement lists, in its order. */
export function timelineOf(arrangement: Arrangement, layout: Layout, tracks: readonly TrackRecord[], tempo: number): TimelineAnswer {
  let resolved: Resolved
  try {
    resolved = resolve(arrangement, { beats: layout.instances.map(({ beats }) => beats), mood: tempo })
  } catch (error) {
    return { refusal: (error as Error).message }
  }
  const segments: Segment[] = []
  for (const region of resolved.regions) {
    const last = segments.at(-1)
    // a new segment begins at every change of the tempo map; two free-time regions in a row are one stretch of free time
    if (last && region.segment === resolved.regions[region.index - 1]!.segment) last.to = region.startSeconds + region.seconds
    else segments.push({ tempo: region.tempo, from: region.startSeconds, to: region.startSeconds + region.seconds })
  }
  const turns = resolved.regions.flatMap((region, i) => (i > 0 && region.iteration !== resolved.regions[i - 1]!.iteration ? [{ seconds: region.startSeconds, iteration: region.iteration }] : []))
  const byId = new Map(tracks.filter(({ state }) => state === 'active').map((record) => [record.track.id, record]))
  const listed = (arrangement.tracks ?? []).flatMap((id) => {
    const record = byId.get(id)
    return record ? [{ id, title: record.title, heard: record.track.heard, makes: record.track.makes ?? null }] : []
  })
  return { ...resolved, beatsPerBar, segments, turns, tracks: listed }
}
