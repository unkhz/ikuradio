---
state: todo
id: 7
kind: issue
slug: xitra-unreachable-and-no-new-songs
---
# xitra is unreachable, and no Song has been made since 19:55

xitra can't be reached from the Mac, and the Archive has had no new Song since Session 1878 (written 17:54:59 UTC, 19:55 in Helsinki). The Radio is on an encore ("favourites") with nothing queued. Songs went 1864 → 1871 → 1878 over the hours before, about seven an hour, so this is a stall and not a quiet spell.

**What is seen from outside** (the loop, at 18:51 UTC, and the hourly watchdog at 19:08 UTC):

- `ssh xitra-song` fails with "Could not resolve hostname xitra.local" (mDNS is silent; `dns-sd -G v4 xitra.local` gets no answer). It began at about 18:01 UTC, a little after the last Song was written.
- The Mac is on the LAN (192.168.88.252) and the internet works: `ikurad.io` and the bucket answer.
- Through `xitra.wg` it fails with "Host key for 65.108.222.75 has changed" (wgproxy). Nobody touched `known_hosts`, and the loop will not clear that line: a changed host key is for the scientist to look at.
- A probe of other LAN addresses found no host with xitra's key; 192.168.88.217 answers SSH with a key that is not xitra's.

**What is not known:** whether xitra is off, asleep or off the network, or whether it is up with mDNS broken and the Heart stuck at the same moment. Nothing on it could be read: not the Heart or its watch timer, the GPU, `heart.log`, the Studio's log or the intro backfill.

**Why it matters beyond the silence:** the Studio's shadow for "The Studio on timelines" (step 2) was counting its ten clean live Songs in `heart.log`; six are confirmed (1870 to 1875), and 1876 to 1878 are unread. Nothing else of that plan runs on xitra until it is back. Nothing was changed on xitra by the loop.

**To do, by the scientist** (the loop cannot, and will not restart or reconfigure a host it cannot reach):

1. Look at xitra: power, network, the `ikuradio-heart` service (`systemctl --user status ikuradio-heart ikuradio-heart-watch.timer`), the tail of `~/Work/song/packages/heart/memory/heart.log`.
2. If it was the network that moved, say so and the loop reads the log again; the Heart may be fine and only the name not resolving.
3. Say what changed the host key of the wg endpoint.
