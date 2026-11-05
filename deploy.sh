#!/bin/bash
# Zero(ish)-downtime deploy for the antaqor Next.js app.
# WHY: `next build` into the live `.next` rewrites chunks/BUILD_ID mid-build, so
# the running `next start` serves HTML referencing now-404 chunks -> /admin breaks
# ("just HTML"). Instead we build into .next-build (live app on .next untouched for
# the whole ~2.4min build), then swap + restart (sub-second blip).
# Usage: bash /var/www/antaqor/deploy.sh
set -o pipefail
cd /var/www/antaqor || exit 1

echo "=== 1/3 TYPECHECK (no .next impact) ==="
npx tsc --noEmit -p tsconfig.json > /tmp/tsc.log 2>&1
ERRS=$(grep -c "error TS" /tmp/tsc.log)
if [ "$ERRS" != "0" ]; then
  echo "TSC_FAILED ($ERRS errors) — aborting, live app untouched:"
  grep "error TS" /tmp/tsc.log | head -30
  exit 1
fi
echo "TSC CLEAN"

echo "=== 2/3 BUILD -> .next-build (live app keeps serving .next) ==="
rm -rf .next-build
NEXT_DIST_DIR=.next-build npx next build > /tmp/build.log 2>&1
RC=$?
tail -6 /tmp/build.log
if [ "$RC" -ne 0 ]; then
  echo "BUILD_FAILED (rc=$RC) — aborting, live app untouched:"
  grep -iE "error|failed" /tmp/build.log | head -20
  rm -rf .next-build
  exit 1
fi

echo "=== 3/3 SWAP + RESTART ==="
rm -rf .next.old
mv .next .next.old
mv .next-build .next
# --distDir bakes ".next-build" into the served manifest; point it back at .next.
sed -i 's#\.next-build#.next#g' .next/required-server-files.json 2>/dev/null || true
pm2 restart antaqor --update-env >/dev/null 2>&1
sleep 4
ROOT=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)
ADMIN=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/admin)
echo "root $ROOT · admin $ADMIN"
if [ "$ADMIN" = "200" ]; then echo "DEPLOY_SUCCESS"; rm -rf .next.old; else echo "DEPLOY_WARN admin=$ADMIN (rollback: mv .next .next.bad && mv .next.old .next && pm2 restart antaqor)"; fi
