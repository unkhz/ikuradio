// The two modes of the Composer (plan "Evolution of Song", "Learn and Edit"): Learn explains, Edit works. The mode is in the URL
// (`?mode=edit`), so a link, a reload and a capture keep it; the browser remembers the last one only for a page asked for without. The
// toggle at the top right swaps the mode of the page you are on. Nothing here names a concept.

const modes = [
  { id: 'learn', says: 'Learn' },
  { id: 'edit', says: 'Edit' },
]
const modeKey = 'composer:mode'

/** The mode this page is in: the URL's, else the last one, else Learn. */
const mode = (() => {
  const asked = new URLSearchParams(location.search).get('mode')
  if (modes.some(({ id }) => id === asked)) {
    try {
      localStorage.setItem(modeKey, asked)
    } catch {}
    return asked
  }
  try {
    const kept = localStorage.getItem(modeKey)
    if (modes.some(({ id }) => id === kept)) {
      const url = new URL(location.href)
      url.searchParams.set('mode', kept)
      history.replaceState(null, '', url)
      return kept
    }
  } catch {}
  return 'learn'
})()

/** A path, in a mode: always said, so that a link to Learn is Learn whatever was last remembered. */
const inMode = (path, as = mode) => `${path}${path.includes('?') ? '&' : '?'}mode=${as}`

/** The toggle, in the header: the page you are on, in the other mode. */
function drawToggle(container) {
  container.className = 'mode-toggle'
  container.setAttribute('role', 'group')
  container.setAttribute('aria-label', 'Mode')
  container.replaceChildren(
    ...modes.map(({ id, says }) => {
      const url = new URL(location.href)
      url.searchParams.set('mode', id)
      const link = Object.assign(document.createElement('a'), { href: url.pathname + url.search, textContent: says })
      if (id === mode) link.setAttribute('aria-current', 'true')
      link.dataset.mode = id
      return link
    }),
  )
}
