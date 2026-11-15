---
date: 2026-11-15
state: active
owner: scientist
id: 13
kind: plan
slug: radio-keeps-a-log
---
# The Radio keeps a log

Nobody knows whether anyone listens. The Radio writes a few lines about its own work to its
console, and Kubernetes keeps only a little of that, and nothing at all once the pod is
replaced. Requests are not recorded anywhere. So the Radio keeps a log of its own: every
request it answers, kept in SQLite on its volume, so that it survives restarts and can be
looked into.

## What changes

1. **A log in `log/radio.db`, on a volume of the node's own.** The log is not kept with the
   Radio's memory on Longhorn. It gets a volume of its own from the cluster's
   `local-storage` class: a directory on one node, declared once as a PersistentVolume
   with node affinity to `k3s-agent-medium-gpj`, where the Radio runs now, and claimed by
   the Radio at `log/`. It survives every deploy, which happens several times a day,
   because the Radio stays on that node. The cost is that the Radio is pinned there; if
   the node is lost, the volume is declared again on another. `local-storage` provisions
   nothing by itself, so the directory must exist on the node before the volume is used;
   creating it needs cluster access, which the setup session has. The Radio opens
   `log/radio.db` with `bun:sqlite` (which works in the compiled executable) and records
   one row per request: the time, method, path, query, status and how long the answer
   took.
2. **Every useful header, for now.** Keep everything that says who asked and from where;
   it will be cleaned up later, once it is clear what matters:
   - **Where from:** `cf-ipcountry`, and Cloudflare's visitor location headers
     `cf-ipcity`, `cf-ipcontinent`, `cf-region`, `cf-region-code`, `cf-metro-code`,
     `cf-postal-code`, `cf-timezone`, `cf-iplatitude` and `cf-iplongitude` (turned on in
     the ikurad.io zone as the managed transform "Add visitor location headers"; until
     then they are simply empty).
   - **Through what:** `cf-ray`, `cf-visitor`, `x-forwarded-proto`, `host`.
   - **Who:** `user-agent`, `referer`, `accept-language`, and the `sec-ch-ua*` client hints.
3. **No addresses at all.** No IP address is stored in any form, not even hashed: not
   `cf-connecting-ip`, not `x-real-ip`, not `x-forwarded-for`. Where a request came from
   is told only by Cloudflare's location headers above. Nothing in the database can tell
   one visitor from another.
4. **Listening is counted, not written line by line.** Every open receiver asks `/tactus`
   every few seconds. Those requests are counted per minute, by country and city, in a
   table of their own, rather than written one row each.
5. **A shell to look in with.** The Radio's image moves from distroless to `debian:12-slim`
   with `sqlite3` installed, so the log can be read where it lies:
   `kubectl -n apps exec -it deploy/ikuradio-radio -- sqlite3 log/radio.db`.

## What stays as it is

- The Archive's downloads come straight from the bucket and are not seen by the Radio;
  the bucket's own console gives their totals.
- The log is never served publicly.
- No cleanup or retention yet. The next step, a plan of its own, syncs the log out of the
  pod to somewhere else, for example daily, so the copy on the node can be deleted.

## Done when

- Requests to `/`, `/s/<n>`, `/songs/page`, `/songs/after` and the page's files are kept
  with their headers and no address of any kind; `/tactus` is counted per minute by country
  and city.
- The log lives on its own `local-storage` volume and survives a redeploy of the Radio.
- `kubectl exec … sqlite3 log/radio.db` opens it in the running pod.
- Logging never slows or breaks an answer: a failed write is skipped, not thrown.
