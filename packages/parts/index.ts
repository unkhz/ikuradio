// Parts (plan "Evolution of Song"): the pieces a Song is made of, each a module in
// a folder of its own. The package finds them by reading its folders; the
// schemas Arrangements are checked by are made from what it found.

export { Part, type LineContext, type LineMeasure, type Place } from './lib/part.js'
export { partsById, partsHome, readParts, type PartRecord } from './lib/registry.js'
export { arrangementSchema, ending, isArrangement, placesOf, refuseArrangement, type Arrangement, type Instance } from './lib/arrangement.js'
export { arrangementsHome, readArrangements, type ArrangementRecord } from './lib/arrangements.js'
export { idSchema, idsOf, parameterSchemas, parametersSchema, refusal, schemas } from './lib/schema.js'
