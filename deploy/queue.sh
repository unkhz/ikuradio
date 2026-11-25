#!/usr/bin/env bash
# Manage the Studio's manual production queue on xitra (~/Work/song/packages/studio/memory/queue.jsonl).
#
# Usage:
#   deploy/queue.sh                                        List queued Songs on xitra
#   deploy/queue.sh add --arrangement the-ascent           Queue The Ascent for the next Song
#   deploy/queue.sh add -a the-ascent -m phrygian -t 68    Queue with custom mode/tempo/mood/sound/etc.
#   deploy/queue.sh pop                                    Remove the first queued Song
#   deploy/queue.sh remove <id>                            Remove a queued Song by id or prefix
#   deploy/queue.sh clear                                  Clear all queued Songs

set -euo pipefail

HOST="${XITRA_HOST:-xitra-song}"
DEST="${XITRA_DEST:-~/Work/song}"

ARGS=""
for arg in "$@"; do
  escaped="${arg//\'/\'\\\'\'}"
  ARGS+=" '$escaped'"
done

ssh -o ConnectTimeout=10 "$HOST" \
  "export PATH=\"\$HOME/.bun/bin:\$PATH\" && cd $DEST/packages/studio && bun queue.ts$ARGS"
