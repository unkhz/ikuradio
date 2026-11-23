// The shell every workspace of a file in Edit shares (plan "Evolution of Song", "Learn and Edit", step 12): which file is open, as a picker, with
// new, copy and open from disk; an unsaved mark; undo and redo, as buttons and as Ctrl/Cmd-Z and Shift-Ctrl/Cmd-Z, across every kind of change;
// the check's answer; and Save, which downloads the file as the server makes its text and is refused while the check refuses. The server
// never writes a file. A draft is kept in `localStorage` as a convenience only. A workspace changes `shell.draft` and says `shell.changed()`;
// the shell checks, remembers, and asks the workspace to draw what the check said. Nothing here names a concept or a kind of file.

/**
 * `noun`: what a file is called. `list()`: the files that are there, `[{ id, title }]`; `fetch(id)`: one of them, as a draft. `blank()`: a draft from nothing.
 * `check(draft)`: the server's answer, `{ refusal?, where? }` and whatever else the workspace draws from. `format(draft)`: `{ text }` or `{ refusal }`.
 * `extra()`: what else a step remembers beside the draft (the selection), and `restore(extra)` puts it back when undo or redo comes to the step. `idOf(draft)`: the file's name. `render(draft)`: draws the workspace anew from a draft. `checked(answer)`: draws the check's answer, on its thing.
 */
function editShell({ noun, list, fetch: fetchOne, blank, check, format, idOf, render, checked, extra, restore }) {
  const state = { draft: undefined, history: [], extras: [], at: -1, saved: undefined, checking: 0, lastPush: 0, lastTarget: null, answer: undefined }
  const memory = `composer:draft:${noun}`
  const snapshot = () => JSON.stringify(state.draft)
  const dirty = () => state.draft !== undefined && snapshot() !== state.saved

  // a chooser, never a stale selection: it says "Open…" whatever is open, and what is open is named beside it
  const picker = el('select', { id: 'which-file', title: `Open another ${noun}` })
  const copy = el('button', { id: 'copy', type: 'button', textContent: 'Copy the open one' })
  const empty = el('button', { id: 'empty', type: 'button', textContent: 'New' })
  const disk = el('label', { className: 'file' }, 'Open from disk ', el('input', { id: 'open', type: 'file', accept: '.json,application/json' }))
  const undo = el('button', { id: 'undo', type: 'button', textContent: '↶ Undo', title: 'Ctrl/Cmd-Z' })
  const redo = el('button', { id: 'redo', type: 'button', textContent: '↷ Redo', title: 'Shift-Ctrl/Cmd-Z' })
  const mark = el('span', { id: 'unsaved', className: 'unsaved', textContent: '● unsaved', hidden: true })
  const nameOf = el('strong', { id: 'open-name', className: 'open-name' })
  const save = el('button', { id: 'save', type: 'button', textContent: 'Save as a file', disabled: true })
  const verdict = el('div', { id: 'verdict', className: 'verdict', role: 'status' })
  const bar = el(
    'div',
    { className: 'shell' },
    el('div', { className: 'controls' }, picker, copy, empty, disk),
    el('div', { className: 'controls' }, nameOf, mark, undo, redo, save),
    verdict,
  )

  function showState() {
    undo.disabled = state.at <= 0
    redo.disabled = state.at >= state.history.length - 1
    mark.hidden = !dirty()
    nameOf.textContent = state.draft === undefined ? '' : idOf(state.draft) || '(no name yet)'
    copy.disabled = state.draft === undefined
    save.disabled = state.draft === undefined || state.answer === undefined || Boolean(state.answer.refusal)
  }

  const remember = () => {
    try {
      localStorage.setItem(memory, JSON.stringify(state.draft))
    } catch {}
  }

  async function run() {
    const mine = ++state.checking
    remember()
    let answer
    try {
      answer = await check(state.draft)
    } catch {
      answer = { refusal: 'the Composer cannot be reached' }
    }
    if (mine !== state.checking) return
    state.answer = answer
    verdict.className = `verdict ${answer.refusal ? 'refused' : 'accepted'}`
    verdict.textContent = answer.refusal ?? `This ${noun} is accepted.`
    checked(answer)
    showState()
    // for whoever drives the page: how many checks have been answered
    verdict.dataset.checks = String(Number(verdict.dataset.checks ?? 0) + 1)
  }

  /** A workspace has changed the draft. Typing in one field is one step, not one for every key. */
  function changed() {
    const now = performance.now()
    const target = document.activeElement
    const typing = target && target === state.lastTarget && target.matches?.('input[type="text"], input[type="number"]') && now - state.lastPush < 700
    const next = snapshot()
    if (next === state.history[state.at]) return run()
    if (typing && state.at > 0) state.history[state.at] = next
    else {
      state.history.length = state.at + 1
      state.extras.length = state.at + 1
      state.history.push(next)
      state.at = state.history.length - 1
    }
    state.extras[state.at] = extra?.()
    state.lastPush = now
    state.lastTarget = target
    showState()
    return run()
  }

  /** What is open is now this draft, with nothing before it to undo; `saved` if it is a file that is there as it is. */
  function begin(draft, { saved }) {
    state.draft = draft
    restore?.(undefined)
    state.history = [snapshot()]
    state.extras = [extra?.()]
    state.at = 0
    state.saved = saved ? snapshot() : undefined
    state.answer = undefined
    render(state.draft)
    return run()
  }

  function go(to) {
    if (to < 0 || to >= state.history.length) return
    state.at = to
    state.draft = JSON.parse(state.history[to])
    state.lastTarget = null
    restore?.(state.extras[to])
    render(state.draft)
    showState()
    return run()
  }

  undo.addEventListener('click', () => go(state.at - 1))
  redo.addEventListener('click', () => go(state.at + 1))
  addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) go(state.at - 1)
    else if ((key === 'z' && event.shiftKey) || key === 'y') go(state.at + 1)
    else return
    event.preventDefault()
  })

  picker.addEventListener('change', async () => {
    const id = picker.value
    picker.value = ''
    if (id) begin(structuredClone(await fetchOne(id)), { saved: true })
  })
  copy.addEventListener('click', () => {
    if (state.draft === undefined) return
    const from = JSON.parse(snapshot())
    from.id = `${from.id}-copy`
    from.title = `${from.title} (copy)`
    begin(from, { saved: false })
  })
  empty.addEventListener('click', () => begin(blank(), { saved: false }))
  disk.querySelector('input').addEventListener('change', async (event) => {
    const [file] = event.target.files
    if (!file) return
    try {
      begin(JSON.parse(await file.text()), { saved: false })
    } catch (error) {
      verdict.className = 'verdict refused'
      verdict.textContent = `that file is not JSON: ${error.message}`
    }
    event.target.value = ''
  })
  save.addEventListener('click', async () => {
    if (save.disabled) return
    // the file's text is the server's: one place makes it, so that a file made here and one written by hand are the same text
    const said = await format(state.draft)
    if (!said.text) {
      verdict.className = 'verdict refused'
      verdict.textContent = said.refusal
      return
    }
    const link = el('a', { href: URL.createObjectURL(new Blob([said.text], { type: 'application/json' })), download: `${idOf(state.draft)}.json` })
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    state.saved = snapshot()
    showState()
  })

  return {
    bar,
    get draft() {
      return state.draft
    },
    changed,
    begin,
    /** The selection has changed without the draft changing: the step it is at remembers it, so that undo and redo bring it back. */
    remember() {
      if (state.at >= 0) state.extras[state.at] = extra?.()
    },
    undo: () => go(state.at - 1),
    redo: () => go(state.at + 1),
    /** Fills the picker with the files there are, and opens the one a reload would have lost, if there was one. */
    async load() {
      const files = await list()
      picker.replaceChildren(el('option', { value: '', textContent: 'Open…' }), ...files.map((file) => el('option', { value: file.id, textContent: file.title })))
      picker.value = ''
      if (state.draft === undefined) {
        try {
          const kept = JSON.parse(localStorage.getItem(memory) ?? 'null')
          if (kept && typeof kept === 'object') await begin(kept, { saved: false })
        } catch {}
      }
      showState()
    },
  }
}
