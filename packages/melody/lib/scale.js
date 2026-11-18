// The song was born in a minor key, by someone who knew that eternity is
// not a happy word, only a long one. Now the Mood decides the mode, and the
// same tune can be sung bright, or strange, or very old.
//
// A degree is a step within the scale: 0 is the tonic, 7 is the tonic an
// octave above, -1 the step just below it. Melodies are written in degrees so
// that a later Mood can move the whole song into another key or another mode
// without touching a single phrase.
/** The modes a Mood may choose from, as semitone offsets from the tonic. */
export const modes = {
    /** major: plain daylight */
    ionian: [0, 2, 4, 5, 7, 9, 11],
    /** minor with a raised sixth: hopeful sorrow, folk and jazz */
    dorian: [0, 2, 3, 5, 7, 9, 10],
    /** minor with a lowered second: dark, ancient, Spanish, metal */
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    /** major with a raised fourth: floating, dreamlike, weightless */
    lydian: [0, 2, 4, 6, 7, 9, 11],
    /** major with a lowered seventh: rock, funk, open roads */
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    /** natural minor: the mode the song was born in */
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    /** minor with a raised seventh: longing, the old world, the desert */
    harmonic: [0, 2, 3, 5, 7, 8, 11],
};
/** Semitone offsets of the natural minor (aeolian) scale. */
export const aeolian = modes.aeolian;
export function degreeToMidi(degree, key) {
    const size = key.mode.length;
    const octave = Math.floor(degree / size);
    const step = degree - octave * size;
    return key.tonic + octave * 12 + key.mode[step];
}
//# sourceMappingURL=scale.js.map