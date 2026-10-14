#!/usr/bin/env bash
# Pull the latest code and rebuild. Run ON the Pi:  npm run update
# The open dashboard reloads itself when the new build lands.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci --silent
npm run build
sudo systemctl restart rpi-dashboard
echo "Updated."
