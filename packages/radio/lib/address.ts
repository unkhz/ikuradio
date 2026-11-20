// A Song's address, read: /s/<number>/<slug>. The address says a slug's letters by percent
// signs (silicon-serenade%C2%B2); the slug is what they spell, as the Archive's `slugOf` makes it.

/** The number and the slug an address asks for, or nothing if it is not one. Number 0 is read, and is no Song. */
export function addressAsked(pathname: string): { song: string; slug: string } | undefined {
  let said = pathname
  try {
    said = decodeURIComponent(pathname).normalize('NFC')
  } catch {
    // a percent sign that spells nothing: the address is taken as it is, and will not be a slug
  }
  const asked = /^\/s\/(0|[1-9]\d{0,399})\/([\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\-]{0,399})$/u.exec(said)
  return asked ? { song: asked[1]!, slug: asked[2]! } : undefined
}
