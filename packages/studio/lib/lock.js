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
export const studioLock = '\0ikuradio-studio';
/** Another Studio is at work on this machine. */
export class StudioBusy extends Error {
    constructor() {
        super('another Studio is at work on this machine; this one does not begin');
        this.name = 'StudioBusy';
    }
}
/**
 * Holds the machine's Studio lock, waiting its way to it: a Studio at work
 * is let finish, and the lock is asked for again until it is free. The runs
 * that ask for it this way hold it long enough for a Studio called in behind
 * them to give up and try again, and that is meant: the Studio at work keeps
 * the mind, and so does the run that waits for it.
 */
export async function holdStudioFree(name = studioLock, { every = 500, until = 24 * 3_600_000, attempt, sleep, } = {}) {
    attempt ??= () => holdStudio(name);
    sleep ??= (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const given = Date.now();
    for (;;) {
        try {
            return attempt();
        }
        catch (error) {
            if (!(error instanceof StudioBusy))
                throw error;
            if (Date.now() - given >= until) {
                throw new Error('the Studio at work has not let go; this run does not take its lock');
            }
            await sleep(every);
        }
    }
}
/** Holds the machine's Studio lock, or throws StudioBusy if another Studio holds it. */
export function holdStudio(name = studioLock) {
    try {
        const listener = Bun.listen({
            unix: name,
            // nobody is meant to call; whoever does is let go at once
            socket: { open: (socket) => void socket.end(), data: () => { } },
        });
        // the lock does not keep the Studio alive: it ends when its work does
        listener.unref();
        return { release: () => listener.stop(true) };
    }
    catch (error) {
        if (error.code === 'EADDRINUSE')
            throw new StudioBusy();
        throw error;
    }
}
//# sourceMappingURL=lock.js.map