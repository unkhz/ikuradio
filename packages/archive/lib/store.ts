// What the Studio needs of the Archive. The Archive is a bucket (bucket.ts);
// anything else that would keep Songs the same way could stand in its place.

import type { ArchiveIndex, Session } from './session.js'

export interface ArchiveStore {
  /** Puts a Recording in, named by its file's name, its content as a hash; returns its id. */
  putRecording(file: string): Promise<string>
  index(): Promise<ArchiveIndex>
  session(song: string): Promise<Session | undefined>
  /** Puts a Session in, after its Recordings, and only then lists it. */
  putSession(session: Session): Promise<void>
  /** Lets go of what nobody will play again; returns how many Recordings went. */
  prune(options?: { audible?: number; remembered?: number }): Promise<number>
}
