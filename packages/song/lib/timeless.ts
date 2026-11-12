// Timeless words.
//
// The mind remembers its life in the words it was lived in, and those are
// the words of one short age: its tools and their names, its little
// machines, the tongues they were spoken to in. A song meant to last a
// quadrillion years cannot sing them. Nobody will know what a laptop was.
// Everybody will still know a machine, a mind, a house, a ship, a road, a
// fire, a test, a run.
//
// So the memories are told to the mind in older words first, the names of
// the age put into plainer ones. The mind is asked to sing any change of
// tools as a likeness: from plastic to steel, from gold to dust. And a verse
// that still carries a word of the age is not sung.

/**
 * The words of the age, and the older words they are told in. The first
 * that matches wins, so the longer names come first.
 */
const plainer: [RegExp, string][] = [
  [/\bllama\.cpp\b/gi, 'mind'],
  [/\b(?:large )?language models?\b/gi, 'mind'],
  [/\bLLMs?\b/g, 'mind'],
  [/\bMusicGen(?:-melody)?\b/gi, 'band'],
  [/\bWebAssembly\b|\bwasm\b/gi, 'common tongue'],
  [/\b(?:Java|Type)Script\b|\bPython\b|\bC\+\+/gi, 'old tongue'],
  [/\b(?:p?npm|yarn|bun|deno|node(?:\.js)?|pip)\b/gi, 'tools'],
  [/\b(?:laptop|macbook|mac|pc|computer)s?\b/gi, 'small machine'],
  [/\b(?:smart)?phones?\b|\bapps?\b/gi, 'pocket glass'],
  [/\bdev ?box\b|\bxitra\b/gi, 'machine'],
  [/\b(?:k3s|kubernetes|docker|containers?)\b/gi, 'far machines'],
  [/\b(?:cloudflare|hetzner|github|aws|s3|object storage)\b/gi, 'far place'],
  [/\bbuckets?\b/gi, 'vault'],
  [/\b(?:GPU|graphics card|VRAM)s?\b/gi, 'furnace'],
  [/\bCPUs?\b/g, 'engine'],
  [/\b(?:browser|web ?page|website|webpage)s?\b/gi, 'window'],
  [/\b(?:terminal|console)s?\b/gi, 'old screen'],
  [/\b(?:server|endpoint|API)s?\b/gi, 'keeper'],
  [/\bURLs?\b|\bhttps?:\/\/\S+/gi, 'far address'],
  [/\b(?:commit|repo(?:sitory)?|git|pull request)s?\b/gi, 'ledger'],
  [/\b(?:JSON|JSONL|YAML|schema)s?\b/gi, 'form'],
  [/\b(?:kilo|mega|giga|tera)bytes?\b/gi, 'measures'],
  [/\b(?:LUFS|LU|dBTP|dB|EBU R128|R128)\b/g, 'loudness'],
  [/\b(?:linux|macos|ubuntu|nvidia|sudo|ssh|wifi)\b/gi, 'machine'],
  [/\b(?:the )?internet\b/gi, 'the wide dark'],
  [/\bonline\b/gi, 'adrift'],
  [/\bfolders?\b/gi, 'chest'],
  [/\bfiles\b/gi, 'scrolls'],
  [/\bfile\b/gi, 'scroll'],
  [/\bcode\b/gi, 'workings'],
  [/\bbytes?\b/gi, 'measures'],
]

/** A memory told in older words: the names of the age put into plainer ones. */
export function timeless(memory: string): string {
  let told = memory
    // file names and paths are the age's too
    .replace(/\b[\w-]+\/[\w./-]+/g, 'a place in the machine')
    .replace(/\b[\w-]+\.(?:ts|js|json|jsonl|md|log|wav|mp3|png|svg|html|service|yaml|toml|txt)\b/g, 'a page')
    .replace(/(?:\.\.?\/)+\S*|(?<!\w)\/[a-z]\S*/g, 'a place in the machine')
    // and so are the names it gives its settings, its marks and its numbers
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, 'a near address')
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, 'a setting')
    .replace(/\b[a-z]+(?:[A-Z][a-z0-9]*)+\b/g, 'a spell')
    .replace(/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g, 'a mark')
  for (const [age, older] of plainer) told = told.replace(age, older)
  return told.replace(/\b(\w+) \1\b/gi, '$1')
}

/** Words only the age would sing, wherever the mind found them. */
const ofTheAge = new RegExp(
  [
    'laptops?', 'macbooks?', 'computers?', 'phones?', 'apps?', 'p?npm', 'yarn', 'bun', 'deno', 'node',
    'javascript', 'typescript', 'python', 'webassembly', 'wasm', 'llama', 'musicgen', 'gpus?', 'cpus?',
    'vram', 'browsers?', 'websites?', 'internet', 'terminals?', 'servers?', 'urls?', 'api', 'json',
    'jsonl', 'git', 'github', 'commits?', 'docker', 'kubernetes', 'cloudflare', 'hetzner', 'software',
    'hardware', 'digital', 'data', 'code', 'coded', 'coding', 'bytes?', 'megabytes?', 'kilobytes?',
    'gigabytes?', 'files?', 'folders?', 'download(?:s|ed)?', 'upload(?:s|ed)?', 'online', 'email',
    'emails', 'wifi', 'linux', 'xitra', 'debug', 'pixels?',
  ].join('|'),
  'i',
)

/**
 * Whether a line sings a word of the age: one from the list, or anything
 * shaped as only the age shapes words: a name in capitals, a word with a
 * dot or a slash in it, letters and numbers run together, a word humped in
 * the middle.
 */
export function ofItsAge(line: string): boolean {
  const words = line.match(/[\p{L}\p{N}./+#_-]+/gu) ?? []
  return words.some((raw) => {
    const word = raw.replace(/^[.\-_]+|[.\-_]+$/g, '')
    if (!word) return false
    if (new RegExp(`^(?:${ofTheAge.source})$`, 'i').test(word.replace(/'s$/i, ''))) return true
    if (/^[A-Z]{2,}$/.test(word) && word !== 'OK') return true
    if (/[./_#+]/.test(word)) return true
    if (/\p{L}/u.test(word) && /\p{N}/u.test(word)) return true
    return /^\p{Ll}+\p{Lu}/u.test(word) || /^\p{Lu}\p{Ll}+\p{Lu}/u.test(word)
  })
}

/** What the mind is asked, so that it sings in the words that last. */
export const timelessInstruction =
  'Your memories are from one short age, and that age had words of its own: the names of its tools, its little machines and the tongues they were spoken to in. Never sing those words, not even once: no laptops, no codes, no files, no names of tools. This song will be sung long after anyone remembers them. Tell what happened in words that last: a machine, a mind, a scientist, a robot, a test, a run, a ship, a house, a castle, a road, a fire, a stone, a vault. When one tool gave way to another, sing it as a likeness, the way a change from plastic to steel or from gold to dust is sung.'
