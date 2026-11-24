---
state: todo
id: 9
kind: issue
slug: sessions-1171-does-not-answer
---
# The Session of Song 1171 does not answer at the store

`sessions/1171.json` in the `ikuradio` bucket does not answer: GET and HEAD time out (curl `000` after 20 s), while its neighbours answer in under 0.1 s (`sessions/1172.json` is 200). It has failed this way at every intro run since at least 11:37 on 2026-11-24 (each run logs "the Archive did not answer (look for sessions/1171.json)" three times or more before it goes on). `sessions/1934.json` did the same for about 15 minutes that morning (08:02 to 08:17 UTC) and recovered by itself; 1171 has not.

**What is not at risk:** the Studio. After 865f2da, `hasSession` falls back to the index, which lists 1171; the intro run copes with the retries and ends cleanly.

**What may be:** the Radio, if its encore ever picks Song 1171: it would wait on a session that never arrives. I have not seen it happen, and I have not read the Radio's code for a timeout on that read.

**Nothing was written or deleted in the Archive**, and the loop will not touch the object: the Archive is for ever.

**To do, by the scientist, if it persists:**

1. Ask Hetzner about the object (a stuck replica on the Ceph side is the likely cause), or re-put the same Session JSON from its source if the scientist chooses to.
2. Say whether the Radio should skip a Song whose session does not answer within a few seconds; I can add that.

**Update 2026-11-24, 15:02 EET:** `sessions/1171.json` answers again (200 in 0.08 s), so the outage was about three and a half hours or less (seen failing from 11:37, answering by 15:02). The Radio did not stall on it that I saw: it stayed live with the next Song set throughout. The question about skipping a Song whose session does not answer is still the scientist's; the Studio's fallback (865f2da) stays either way.
