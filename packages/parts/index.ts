// Parts (plan "Evolution of Song"): the pieces a Song is made of, each a module in
// a folder of its own. The package finds them by reading its folders; the
// schemas Arrangements are checked by are made from what it found.

export { Part, type LineContext, type LineMeasure, type Place, type WordMode } from './lib/part.js'
export { parseRecord, type RecordState } from './lib/record.js'
export { partsById, partsHome, readParts, type PartRecord } from './lib/registry.js'
export { arrangementSchema, ending, isArrangement, placesOf, refuseArrangement, type Arrangement, type Instance } from './lib/arrangement.js'
export { arrangementsHome, readArrangements, type ArrangementRecord } from './lib/arrangements.js'
export { idSchema, idsOf, parameterSchemas, parametersSchema, refusal, schemas } from './lib/schema.js'
export { Track, type Making } from './lib/track.js'
export { readTracks, tracksHome, type TrackRecord } from './lib/tracks.js'
export { boundaryOf, iterationsOf, makingsOf, refuseTimeline, regionIndex, resolve, tempoOf, timelineShape, type Anchor, type Block, type Lengths, type Placing, type Region, type Resolved, type ResolvedBlock, type ResolvedRegion, type TempoPoint, type Timeline, type ToMake } from './lib/timeline.js'
export { fieldsOf } from './lib/words.js'
