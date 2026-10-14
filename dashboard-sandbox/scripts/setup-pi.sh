#!/usr/bin/env bash
# One-shot Raspberry Pi setup. Run ON the Pi from the project root:
#   ./scripts/setup-pi.sh
# Safe to re-run.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_NAME="$(id -un)"
cd "$DIR"

echo "==> Installing system packages"
sudo apt-get update
sudo apt-get install -y curl rsync fonts-noto-color-emoji mpv # mpv plays the Quran recitation
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Installing Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

[ -f .env ] || { cp .env.example .env; echo "==> Created .env — edit it with your location/API keys"; }

echo "==> Installing dependencies and building"
npm ci
npm run build

echo "==> Installing systemd service"
sed -e "s#__USER__#$USER_NAME#g" -e "s#__UID__#$(id -u)#g" -e "s#__DIR__#$DIR#g" deploy/rpi-dashboard.service \
  | sudo tee /etc/systemd/system/rpi-dashboard.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable rpi-dashboard
sudo systemctl restart rpi-dashboard # restart, so a re-run picks up a changed service file

echo "==> Adding kiosk to labwc autostart"
AUTOSTART="$HOME/.config/labwc/autostart"
mkdir -p "$(dirname "$AUTOSTART")"
touch "$AUTOSTART"
grep -q "scripts/kiosk.sh" "$AUTOSTART" || echo "$DIR/scripts/kiosk.sh &" >> "$AUTOSTART"

echo "==> Disabling screen blanking"
command -v raspi-config >/dev/null && sudo raspi-config nonint do_blanking 1 || true

echo
echo "Done. Reboot to launch the dashboard full-screen:  sudo reboot"
echo "Or launch now (from the Pi's desktop session):     ./scripts/kiosk.sh"
