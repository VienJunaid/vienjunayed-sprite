#!/usr/bin/env bash
# Opens the dashboard full-screen. Waits for the server first.
# On the Pi this runs from labwc autostart; on macOS it's handy for previewing.
set -euo pipefail

URL="${DASHBOARD_URL:-http://127.0.0.1:${PORT:-8080}}"

for _ in $(seq 1 60); do
  curl -fs "$URL/api/health" >/dev/null && break
  sleep 1
done

FLAGS=(--kiosk --noerrdialogs --disable-infobars --no-first-run
       --disable-session-crashed-bubble --disable-translate
       --check-for-update-interval=31536000 --autoplay-policy=no-user-gesture-required)

if [[ "$(uname)" == "Darwin" ]]; then
  exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --user-data-dir="${TMPDIR:-/tmp}/rpi-dashboard-chrome" "${FLAGS[@]}" "$URL"
fi

BROWSER="$(command -v chromium || command -v chromium-browser)"
exec "$BROWSER" "${FLAGS[@]}" --ozone-platform=wayland "$URL"
