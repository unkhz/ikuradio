// A record's state, slug, title and words, from its frontmatter and heading: the same for the records
// of parts and the records of Arrangements.

export type RecordState = 'draft' | 'active' | 'retired'

/** What a record says: its state and slug, its title (the heading), and the words under it. `where` names the folder, for the error. */
export function parseRecord(text: string, where: string, what: string): { slug: string; title: string; state: RecordState; text: string } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error(`${where}: ${what} record begins with frontmatter`)
  const fields = Object.fromEntries(
    match[1]!.split('\n').flatMap((line) => {
      const at = line.indexOf(':')
      return at > 0 ? [[line.slice(0, at).trim(), line.slice(at + 1).trim()]] : []
    }),
  )
  const body = text.slice(match[0].length)
  const title = /^# (.+)$/m.exec(body)?.[1]?.trim() ?? fields.slug
  const words = body.replace(/^# .+$/m, '').trim()
  return { slug: fields.slug as string, title: title as string, state: fields.state as RecordState, text: words }
}
