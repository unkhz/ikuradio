---
state: todo
id: 2
kind: issue
slug: zalando-cache-conventions
---
# Does the cache's postgresql resource match the cluster's postgres-operator?

Plan "Searching the Songs received", step 2. Neither the relaying session nor I could reach the cluster, and no local repository has the operator's setup. So `.khz-k3s/cache.yaml` follows the operator's documented defaults:

- `teamId: ikuradio`, with the cluster named `ikuradio-cache` (the operator wants the name to start with the team).
- The user `radio` owns the database `songs`.
- The Secret is `radio.ikuradio-cache.credentials.postgresql.acid.zalan.do`, with the keys `username` and `password`.
- The Service is `ikuradio-cache` in `apps`, port 5432.
- Postgres 16, `storageClass: longhorn`, 1Gi, `enableLogicalBackup: false`.

Things to check once Argo has synced:
- Does the operator here allow the team `ikuradio`? Some setups list allowed teams, or override the Secret's name template.
- Are WAL backups turned on for the whole operator? If so they apply here too. For a cache they're wasted, not harmful.
- Does a NetworkPolicy keep the Radio from the database?

Meanwhile: the Radio reads the Secret with `optional: true`, so a wrong name only means no search. The list still works from the Tactus. The Radio speaks TLS without checking the certificate, since the operator's Postgres makes its own (`CACHE_TLS`).

To see whether it works, ask the Radio for `/songs/options`: 200 means the cache is there, 503 means it is away. The Radio's log says "the cache of the Songs received is there" and how many Songs it filled.
