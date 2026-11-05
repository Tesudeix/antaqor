#!/usr/bin/env bash
# Хөгжүүлэлт бүрийг хувилбар болгоно (2026-11-05). Сервер дээр, build амжилттай болсны дараа:
#   bash scripts/release.sh "Tesla Trader v7: тайлбар" trader-v7
# Зөвхөн аппын замуудыг commit хийнэ — .env, data/, logs/, uploads/, .bak, том файл ордоггүй.
# Сервер GitHub-т өөрөө push хийх эрхгүй. Mac-ийн түлхүүрийг дамжуулж түлхэнэ (ssh-add ~/.ssh/id_ed25519_tesudeix):
#   ssh -A root@178.128.104.98 'cd /var/www/antaqor && git push git@github.com:Tesudeix/antaqor.git production "refs/tags/trader-*:refs/tags/trader-*"'
set -euo pipefail
cd "$(dirname "$0")/.."
msg=${1:?commit мессеж өгнө үү}; tag=${2:-}
[ "$(git branch --show-current)" = "production" ] || { echo "production салбар дээр биш"; exit 1; }
git add -A -- src public scripts test .gitignore package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs
if git diff --cached --quiet; then echo "өөрчлөлт алга"; else
  git commit -q -m "$msg" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
fi
if [ -n "$tag" ]; then git tag -a "$tag" -m "$msg"; fi
git log --oneline -1
