state: todo
id: 4
kind: issue
slug: music-gone-since-song-906
---
# The band has not come for any Song since 906

The archived Sessions keep the band's beds as `kind: 'bed'` recordings, shelved before the Session that names them. Every Song from 1 to 905 has beds (20–40 of them); Songs 906–948 have none, and every Song since has aired over a bare floor. The Receiver mixes the beds 6 LU under the voices; there are simply no beds to mix.

The last bed (Song 905) was shelved before the song-names deploy, so the deploy is not the cause. The change is in the code synced to xitra around that evening, or in the Studio's run environment there: the band's wake, the GPU, the disk, the model.

The design lets this pass: when `underlay` fails for an iteration, the Studio only warns, `the Music did not come for iteration N`, and archives the Song bare. That is the mercy for the Song and the shelter for the bug.

To do:

- Find the Studio's run log on xitra and read the evening of Song 906: the first "the Music did not come", and its neighbours.
- Check what code was synced to xitra at that time against the history of the studio and music packages.
- Decide whether a Song without beds is refused, or at least marked, instead of archived bare.
