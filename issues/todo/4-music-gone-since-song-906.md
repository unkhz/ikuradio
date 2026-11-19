state: todo
id: 4
kind: issue
slug: music-gone-since-song-906
---
# The band has not come for any Song since 906

The archived Sessions keep the band's beds as `kind: 'bed'` recordings, shelved before the Session that names them. Every Song from 1 to 905 has beds (20–40 of them); Songs 906–948 have none, and every Song since has aired over a bare floor. The Receiver mixes the beds 6 LU under the voices; there are simply no beds to mix.

The last bed (Song 905) was shelved before the song-names deploy, so the deploy is not the cause. The change is in the code synced to xitra around that evening, or in the Studio's run environment there: the band's wake, the GPU, the disk, the model.

The design lets this pass: when `underlay` fails for an iteration, the Studio only warns, `the Music did not come for iteration N`, and archives the Song bare. That is the mercy for the Song and the shelter for the bug.

Found, and mended (Nov 18): the mind never rested. A naming run woke `llama-server` at 21:23 on Nov 17 (PID 3866136) and died without resting it — `process.once('exit', letGo)` in waking.ts covers a clean end, not a kill. The orphan held 9.29 GiB of the 11.65 GiB GPU, and every `wakeBand` since fell to `torch.OutOfMemoryError`, naming in its own text the process that held the room. Studios find a mind already awake, ask it, and never rest what they did not wake: the very trap waking.ts names in its comment. The orphan was let rest at 18:17 on Nov 18; the band woke in 5.2 s, and Song 950 carries 20 beds.

To do:

- Find the Studio's run log on xitra and read the evening of Song 906: the first "the Music did not come", and its neighbours. — done, above.
- Check what code was synced to xitra at that time against the history of the studio and music packages. — done: no code caused it; a killed naming run did.
- Decide whether a Song without beds is refused, or at least marked, instead of archived bare. — done 2026-11-19: refused. A Studio whose every iteration came without a bed stops before it puts anything in (packages/studio/lib/bare.ts); the Heart calls another in 30 s, the encores fill the gap. Songs 906–948 stay bare: the Archive is for ever.
- Nothing reaps an ownerless mind. A Studio that cannot wake the band could tell whether a mind it does not own holds the GPU, and say so; the Heart could rest one that no process owns.
