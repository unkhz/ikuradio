// A Song with no band at all is not kept (issue 4). When the band cannot wake,
// the Studio used to warn and archive the Song over a bare floor, and for
// forty-three Songs it did, for ever, since the Archive keeps what it is given.
// Now such a Song is refused: the Studio stops without putting anything in,
// the Heart calls another in half a minute, and the encores fill the gap.

/** Whether a made Song has no bed in any iteration. */
export const isBare = (made: readonly { beds: readonly unknown[] }[]) => made.every(({ beds }) => beds.length === 0)
