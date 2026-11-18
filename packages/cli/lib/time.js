// The terminal keeps time the way the page does: every Recording of a Song
// is placed at its moment from the Song's beginning, and one whose moment
// has passed is joined where it would be by now. One already over asks
// ffplay to begin past its end, and ffplay simply plays nothing.
/**
 * When to start each recording, from now, in seconds, and from how far into
 * it. A recording whose place in the Song is already over is left out.
 */
export function placements(recordings, since) {
    const over = ({ at, seconds, fade = 0 }) => seconds !== undefined && at + seconds + fade <= since;
    return recordings.filter((r) => !over(r)).map((recording) => {
        const after = recording.at - since;
        return after >= 0
            ? { recording, after, from: 0 }
            : { recording, after: 0, from: -after };
    });
}
//# sourceMappingURL=time.js.map