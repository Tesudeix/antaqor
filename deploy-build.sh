#!/bin/sh
# Zero-downtime deploy: build into .next-staging while the live .next keeps
# serving, then swap atomically and restart pm2. Prevents mid-build 500s.
set -e
cd /var/www/antaqor
rm -rf .next-staging
NEXT_DIST_DIR=.next-staging npm run build
rm -rf .next-prev
mv .next .next-prev
mv .next-staging .next
pm2 restart antaqor
echo SWAP_DONE
