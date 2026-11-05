#!/usr/bin/env bash
# Build + snapshot a release, then restart. Each release stores the built .next
# artifact and the git SHA, so rollback.sh can restore a known-good build in
# seconds WITHOUT rebuilding. Safe with the existing in-place `next start` / pm2
# layout — no process migration.
set -euo pipefail

APP=antaqor
ROOT=/var/www/antaqor
REL=/var/www/antaqor-releases
TS=$(date +%Y%m%dT%H%M%SZ)

cd "$ROOT"

echo "[deploy $TS] building…"
npm run build

echo "[deploy $TS] snapshotting artifact…"
mkdir -p "$REL/$TS"
tar -czf "$REL/$TS/next.tgz" .next
( git rev-parse HEAD 2>/dev/null || echo "no-git" ) > "$REL/$TS/git_sha"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$REL/$TS/built_at"
echo "$TS" > "$REL/CURRENT"
ln -sfn "$TS" "$REL/current"

# keep the last 5 releases only
ls -1dt "$REL"/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "[deploy $TS] restarting pm2…"
pm2 restart "$APP" --update-env >/dev/null

echo "[deploy $TS] LIVE — release $TS  sha=$(cat "$REL/$TS/git_sha")"
