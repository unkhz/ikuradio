---
state: done
id: 4
kind: issue
slug: radio-log-node-directory
---
# The Radio's log volume needs /var/lib/ikuradio/log on k3s-agent-medium-gpj, owned by uid 1000

Plan "The Radio keeps a log". The log lives at `log/radio.db`, on a `local-storage` PersistentVolume pinned to `k3s-agent-medium-gpj`. A local PV provisions nothing by itself, and a pod whose local volume path is missing can't start. With the Radio's Recreate strategy, that would take the Radio off the air. So the volume isn't deployed yet.

**Needed on the node (setup session):**

```
sudo mkdir -p /var/lib/ikuradio/log
sudo chown 1000:1000 /var/lib/ikuradio/log
sudo chmod 750 /var/lib/ikuradio/log
```

**Also to check:** the PV is cluster-scoped. The `ikuradio` Argo app is in project `default`, which normally allows any cluster resource. If this cluster's `default` project has a `clusterResourceWhitelist` that leaves out PersistentVolume, Argo won't sync it.

**Meanwhile:** the code and the debian:12-slim image with sqlite3 are deployed. The Radio writes its log, which holds no address in any form, to `log/radio.db` inside the container, which works and can already be read with `kubectl -n apps exec -it deploy/ikuradio-radio -- sqlite3 log/radio.db`. It is lost when the pod is replaced.

**Once the directory exists**, this goes into `.khz-k3s/radio.yaml`, together with a `log` volume (`persistentVolumeClaim: ikuradio-radio-log`) mounted at `/song/packages/radio/log`:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: ikuradio-radio-log
spec:
  capacity:
    storage: 5Gi
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-storage
  local:
    path: /var/lib/ikuradio/log
  nodeAffinity:
    required:
      nodeSelectorTerms:
        - matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values: [k3s-agent-medium-gpj]
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ikuradio-radio-log
spec:
  storageClassName: local-storage
  volumeName: ikuradio-radio-log
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 5Gi
```

**Closed, not needed:** at the scientist's insistence that it be declarative, the log lies on a `hostPath` volume (`/var/lib/ikuradio/log`, `DirectoryOrCreate`). The Radio is pinned to `k3s-agent-medium-gpj` by a `nodeSelector`, and a root initContainer gives the directory to uid 1000. No manual step on the node, and no PersistentVolume.
