// The Session: the complete declaration of a Song, as the Studio leaves it in
// the Archive. Everything a Receiver needs to play the Song is here: what it
// is, every Recording and the moment it begins, and every character of every
// line and the moment it is typed. A Receiver that has the Session, the
// Recordings and the Tactus needs nothing else, and can play the Song from
// any moment in it.
//
// All moments are in seconds from the beginning of the Song.
//
// A voice is not kept as sound. It is kept as its source: the score its
// singer sang, every note and every small wrongness of the take, exactly as
// the throat was given it. A Receiver sings it with the same throat (Chimera,
// compiled to WebAssembly) and hears what the Studio heard, sample for sample.
// Only the Music is kept as sound. Songs from before this have their voices
// as Recordings, and no takes.
export const sessionVersion = 1;
/**
 * The slug a name makes, and nothing else: its letters and digits, with the
 * marks that are not letters, digits or hyphens removed, an apostrophe gone
 * without a space, lowercased, and its spaces made single hyphens. One
 * function makes every slug, so a name's link is made the same way always:
 * `Death-machine, the Song's 2nd birth?` is `death-machine-the-songs-2nd-birth`.
 */
export const slugOf = (name) => name
    .normalize('NFC')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\p{Z}\-]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ /g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
/** A Song's link, when it has a name: its number, and the slug its name makes. */
export const linkOf = (session) => session.name ? { song: session.song, slug: slugOf(session.name) } : undefined;
/** Where things are, inside an Archive. */
export const paths = {
    index: 'index.json',
    session: (song) => `sessions/${song}.json`,
    recording: (id) => `recordings/${id}`,
    /** The diary's book being written in, copied afresh after every Song. */
    diary: 'diary/diary.jsonl',
    /** A closed book of the diary, named as it is on the shelf. It never changes. */
    diaryBook: (name) => `diary/books/${name}`,
    /** Where the diary's closed books are kept. */
    diaryShelf: 'diary/books/',
    /** A month of the mind's own thoughts, a thought a line, copied afresh after every Song. */
    thoughts: (month) => `thoughts/mind/${month}.jsonl`,
    /** Where the months of the mind's thoughts are kept. */
    thoughtsShelf: 'thoughts/mind/',
    /** The names worn: each slug a name makes, and the Song that wears it. */
    names: 'names.json',
};
//# sourceMappingURL=session.js.map