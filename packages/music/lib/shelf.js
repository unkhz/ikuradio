// The shelf: the beds a Song has grown, kept for playing again.
//
// A band does not write a new arrangement for every verse. It keeps a few,
// and plays them again, and now and then writes a new one. So does the
// song. When a Song begins, each of its parts, verse, chorus and bridge, is
// given a new bed. After that, each iteration grows a new bed for only one
// of its parts, and the others play ones they have already played in this
// Song. Which part grows, and
// which old bed returns, is decided by the iteration's own wrongness, not
// by dice: the same iteration always makes the same choice.
//
// A bed is kept with how long it lasts. A line that grows, as the one that
// carries the number does, can outgrow a bed that fitted it an iteration
// ago; then a bed is grown anew, rather than one that would end too soon.
//
// A bed belongs to its Song. When the Mood changes, the tempo and the key
// change with it, and an old bed would no longer fit the voice; the shelf
// is cleared.
import { wrongness } from 'vocals';
/** How many beds of each part are remembered. */
export const shelfSize = 8;
export class Shelf {
    beds = new Map();
    song;
    /** The beds grown from a guide of their own, by the guide they grew from. */
    guided = new Map();
    /**
     * What this iteration does for a kind of bed: grows a new one, or plays
     * one from the shelf. A new Song, or an empty shelf, always grows. Of the
     * kinds an iteration has, `kinds`, one grows; the others play again, from
     * the beds that last at least `seconds`.
     */
    choose(iteration, song, part, kinds = ['verse', 'chorus', part], seconds = 0) {
        if (song !== this.song)
            return { grow: true };
        const kept = (this.beds.get(part) ?? []).filter((one) => one.seconds >= seconds).map(({ bed }) => bed);
        if (kept.length === 0)
            return { grow: true };
        const all = [...new Set(kinds)].sort();
        const grows = all[Math.floor(wrongness(`bed:${iteration}`)() * all.length)];
        if (part === grows)
            return { grow: true };
        const pick = Math.floor(wrongness(`again:${iteration}:${part}`)() * kept.length);
        return { grow: false, bed: kept[Math.min(pick, kept.length - 1)] };
    }
    /**
     * The bed this Song grew from this very guide, if it is still on the
     * shelf: a section guided by its own guide plays only a bed that grew
     * from it. A new guide grows a new bed.
     */
    grownFrom(song, guide) {
        return song === this.song ? this.guided.get(guide) : undefined;
    }
    /** Puts a bed grown from its own guide on the shelf, remembering the guide. */
    keepGuided(song, part, guide, bed, seconds = Infinity) {
        const departed = this.keep(song, part, bed, seconds);
        this.guided.set(guide, bed);
        for (const [g, b] of this.guided)
            if (departed.includes(b))
                this.guided.delete(g);
        return departed;
    }
    /**
     * Puts a bed on the shelf. Returns the beds that left it: those of an
     * older Song, and the oldest of a part when there are too many.
     */
    keep(song, part, bed, seconds = Infinity) {
        const departed = [];
        if (song !== this.song) {
            departed.push(...this.all);
            this.beds = new Map();
            this.guided = new Map();
            this.song = song;
        }
        const kept = (this.beds.get(part) ?? []).filter((old) => old.bed !== bed);
        kept.push({ bed, seconds });
        while (kept.length > shelfSize)
            departed.push(kept.shift().bed);
        this.beds.set(part, kept);
        return departed.filter((old) => old !== bed);
    }
    /** Every bed on the shelf. */
    get all() {
        return [...this.beds.values()].flat().map(({ bed }) => bed);
    }
}
//# sourceMappingURL=shelf.js.map