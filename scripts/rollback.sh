#!/usr/bin/env bash
# Restore a previous release's built artifact and restart — NO rebuild, <10s.
# Usage:  ./rollback.sh            # roll back to the previous release
#         ./rollback.sh <TS>       # roll back to a specific release id
#         ./rollback.sh --list     # list available releases
set -euo pipefail

APP=antaqor
ROOT=/var/www/antaqor
REL=/var/www/antaqor-releases

if [ "${1:-}" = "--list" ]; then
  printf "%-22s %-10s %s\n" RELEASE SHA BUILT_AT
  for d in $(ls -1dt "$REL"/*/ 2>/dev/null); do
    id=$(basename "$d")
    [ "$id" = "current" ] && continue   # skip the symlink
    printf "%-22s %-10s %s\n" "$id" "$(cut -c1-7 "$d/git_sha" 2>/dev/null)" "$(cat "$d/built_at" 2>/dev/null)"
  done
  exit 0
fi

CUR=$(cat "$REL/CURRENT" 2>/dev/null || echo "")
if [ -n "${1:-}" ]; then
  TARGET="$1"
else
  TARGET=$(ls -1dt "$REL"/*/ 2>/dev/null | sed 's#/$##;s#.*/##' | grep -v "^current$" | grep -v "^${CUR}$" | head -1)
fi

[ -n "$TARGET" ] && [ -f "$REL/$TARGET/next.tgz" ] || { echo "[rollback] no restorable release '$TARGET'"; exit 1; }

echo "[rollback] restoring $TARGET (was $CUR)…"
cd "$ROOT"
rm -rf .next
tar -xzf "$REL/$TARGET/next.tgz"
echo "$TARGET" > "$REL/CURRENT"
ln -sfn "$TARGET" "$REL/current"
pm2 restart "$APP" --update-env >/dev/null
echo "[rollback] LIVE — release $TARGET  sha=$(cat "$REL/$TARGET/git_sha")"
