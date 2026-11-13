// What the Studio needs of the Archive. The Archive is forever: nothing put
// in it is ever taken out again. Copies of it may be: a Studio that wakes on
// a machine that has forgotten the song reads its memory back out of it. The Archive is a bucket (bucket.ts);
// anything else that would keep Songs the same way could stand in its place.

import type { ArchiveIndex, Session } from './session.js'

export interface ArchiveStore {
  /** Puts a Recording in, named by its file's name, its content as a hash; returns its id. */
  putRecording(file: string): Promise<string>
  index(): Promise<ArchiveIndex>
  session(song: string): Promise<Session | undefined>
  /** Whether a Song's Session is there. Throws if the Archive cannot say. */
  hasSession(song: string): Promise<boolean>
  /** Puts a Session in, after its Recordings, and only then lists it. */
  putSession(session: Session): Promise<void>
  /**
   * Keeps a copy of the diary, so the song's memory is not on one machine
   * only: every closed book once, and the book being written in afresh.
   * Returns how many books were shelved for the first time.
   */
  putDiary(diary: { writing: string; books: string[] }): Promise<number>
  /**
   * Keeps a copy of a month of the mind's thoughts, from its file named
   * <yyyy-mm>.jsonl, afresh: the month only ever grows.
   */
  putThoughts(file: string): Promise<void>
  /**
   * The newest Song the Archive holds, or nothing if it holds none yet.
   * Throws if the Archive cannot say: not knowing is not the same as none.
   */
  newestSong(): Promise<string | undefined>
  /** The names of everything kept at a place in the Archive, such as `diary/books/`. */
  kept(prefix: string): Promise<string[]>
  /**
   * Copies something kept in the Archive out, into a file on this machine,
   * whole or not at all. Returns whether it was there to copy.
   */
  copyOut(key: string, file: string): Promise<boolean>
}
