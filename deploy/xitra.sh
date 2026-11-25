#!/usr/bin/env bash
# Sync tracked and unignored files from this checkout to xitra-song:~/Work/song.
# Never touches git-ignored state on xitra (node_modules, .env.local, memory, models, .chimera).
#
# Usage:
#   deploy/xitra.sh              Sync files and print Heart/Studio status
#   deploy/xitra.sh --test       Sync files and run Studio/Parts/Vocals verification tests on xitra
#   deploy/xitra.sh --restart    Sync files and gracefully restart ikuradio-heart.service
#   deploy/xitra.sh --status     Read-only Heart/Studio status on xitra (no sync)
#   deploy/xitra.sh --dry-run    Show what would be synced without connecting

set -euo pipefail

HOST="${XITRA_HOST:-xitra-song}"
DEST="${XITRA_DEST:-~/Work/song}"
DO_SYNC=1
DO_TEST=0
DO_RESTART=0
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --test) DO_TEST=1 ;;
    --restart) DO_RESTART=1 ;;
    --status) DO_SYNC=0 ;;
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$DO_SYNC" -eq 1 ]; then
  HEAD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  FILE_COUNT="$(git ls-files -co --exclude-standard | wc -l | tr -d ' ')"
  echo "Syncing $FILE_COUNT files from $BRANCH ($HEAD_SHA) -> $HOST:$DEST"
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "Dry run — skipping transfer."
    exit 0
  fi
  git ls-files -co --exclude-standard \
    | COPYFILE_DISABLE=1 tar -c -T - -f - \
    | ssh -o ConnectTimeout=10 "$HOST" "tar --warning=no-unknown-keyword -x -C $DEST"
  echo "Sync complete."
fi

if [ "$DO_TEST" -eq 1 ]; then
  echo "Running verification tests on $HOST..."
  ssh -o ConnectTimeout=10 "$HOST" \
    "export PATH=\"\$HOME/.bun/bin:\$PATH\" && cd $DEST && bun test ./packages/parts/lib/components.test.ts ./packages/studio/lib/arrangement.test.ts ./packages/studio/lib/components.test.ts ./packages/vocals/lib/synth.test.ts ./packages/studio/lib/lock.test.ts"
fi

if [ "$DO_RESTART" -eq 1 ]; then
  echo "Gracefully restarting ikuradio-heart.service on $HOST..."
  ssh -o ConnectTimeout=10 "$HOST" "systemctl --user restart ikuradio-heart.service"
fi

echo "Status on $HOST:"
ssh -o ConnectTimeout=10 "$HOST" \
  'systemctl --user is-active ikuradio-heart.service 2>/dev/null || true; ps -ef | grep -E "heart|studio" | grep -v grep || true'
