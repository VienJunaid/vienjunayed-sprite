#!/usr/bin/env bash
# Push local code to the Pi, rebuild, and restart. Run from your Mac:
#   npm run deploy
# Reads PI_HOST / PI_DIR from .env (defaults: pi@raspberrypi.local, ~/rpi-dashboard).
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

PI_HOST="${PI_HOST:-pi@raspberrypi.local}"
PI_DIR="${PI_DIR:-/home/pi/rpi-dashboard}"

echo "==> Syncing to $PI_HOST:$PI_DIR"
rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude .env --exclude data --exclude .DS_Store \
  ./ "$PI_HOST:$PI_DIR/"

echo "==> Building and restarting on the Pi"
ssh "$PI_HOST" "cd '$PI_DIR' && npm ci --silent && npm run build && sudo systemctl restart rpi-dashboard"

echo "Deployed. Chromium picks up the new build on reload (or: ssh $PI_HOST 'pkill -f chromium' — autostart relaunches on next login)."
