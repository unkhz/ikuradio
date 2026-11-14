// One Studio to a machine.
//
// Two Studios on one machine write one diary, sweep each other's recordings
// away as leftovers, and fight over the GPU: they make the same Song twice.
// So a Studio first holds the machine's lock, and if another holds it, it
// stops at once, before it touches anything.
//
// The lock is a listening socket in Linux's abstract namespace: a name with
// no file behind it, held for as long as the process that bound it lives.
// The kernel lets it go when that process ends, however it ends, so a Studio
// that was killed never leaves a lock behind for the next one to trip on.
// The Studio lives on Linux only; elsewhere the name cannot be bound.

/** The name every Studio on a machine holds: the same for all of them. */
export const studioLock = '\0ikuradio-studio'

/** Another Studio is at work on this machine. */
export class StudioBusy extends Error {
  constructor() {
    super('another Studio is at work on this machine; this one does not begin')
    this.name = 'StudioBusy'
  }
}

/** A held lock: let go of it when the work is done (or simply end). */
export type Held = { release(): void }

/** Holds the machine's Studio lock, or throws StudioBusy if another Studio holds it. */
export function holdStudio(name = studioLock): Held {
  try {
    const listener = Bun.listen({
      unix: name,
      // nobody is meant to call; whoever does is let go at once
      socket: { open: (socket) => void socket.end(), data: () => {} },
    })
    // the lock does not keep the Studio alive: it ends when its work does
    listener.unref()
    return { release: () => listener.stop(true) }
  } catch (error) {
    if ((error as { code?: string }).code === 'EADDRINUSE') throw new StudioBusy()
    throw error
  }
}
