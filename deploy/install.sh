#!/usr/bin/env bash
# Runs ON the device, from inside an unpacked release. Installs/updates the
# whole v2 stack: Node 24, server, UI, pm2 process, nginx site.
# Safe to re-run: preserves .env, the database, frames and prints.
#
# Usage: sudo bash install.sh
set -euo pipefail

APP_ROOT="/home/snapnkeep/servers/v2"
APP_USER="snapnkeep"
HERE="$(cd "$(dirname "$0")" && pwd)"
NODE_PREFIX="/usr/local/lib/nodejs"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run with sudo: sudo bash install.sh"
  exit 1
fi

echo "==> Node runtime"
NODE_TARBALL="$(ls "$HERE"/node-v*-linux-x64.tar.xz | head -1)"
NODE_DIR="$NODE_PREFIX/$(basename "$NODE_TARBALL" .tar.xz)"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  mkdir -p "$NODE_PREFIX"
  tar -xJf "$NODE_TARBALL" -C "$NODE_PREFIX"
fi
ln -sf "$NODE_DIR/bin/node" /usr/local/bin/node
ln -sf "$NODE_DIR/bin/npm" /usr/local/bin/npm
ln -sf "$NODE_DIR/bin/npx" /usr/local/bin/npx
echo "    node: $(/usr/local/bin/node -v)"

echo "==> App files → $APP_ROOT (data preserved)"
mkdir -p "$APP_ROOT"
rsync -a --delete "$HERE/server/" "$APP_ROOT/server/" \
  --exclude ".env" --exclude "*.sqlite3" --exclude "*.sqlite3-shm" \
  --exclude "*.sqlite3-wal" --exclude "public/"
mkdir -p "$APP_ROOT/server/public/frames" "$APP_ROOT/server/public/prints"
rsync -a --delete "$HERE/ui/" "$APP_ROOT/ui/"
rsync -a --delete "$HERE/pm2/" "$APP_ROOT/pm2/"
cp "$HERE/ecosystem.config.cjs" "$APP_ROOT/"
[ -f "$APP_ROOT/server/.env" ] || cp "$HERE/env.example" "$APP_ROOT/server/.env"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

echo "==> Stopping legacy processes on ports 8080/4000/3001 (if any)"
for port in 8080 4000 3001; do
  pids="$(fuser -n tcp "$port" 2>/dev/null || true)"
  if [ -n "${pids// /}" ]; then
    echo "    killing port $port (pids:$pids)"
    fuser -k -n tcp "$port" || true
  fi
done
sleep 1

echo "==> pm2"
PM2="$APP_ROOT/pm2/node_modules/.bin/pm2"
sudo -u "$APP_USER" "$PM2" delete snapnkeep-server >/dev/null 2>&1 || true
sudo -u "$APP_USER" "$PM2" start "$APP_ROOT/ecosystem.config.cjs"
sudo -u "$APP_USER" "$PM2" save
# boot persistence (idempotent): generates+installs a systemd unit that
# resurrects the pm2-managed processes on startup
"$PM2" startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null || true
systemctl enable "pm2-$APP_USER" >/dev/null 2>&1 || true

echo "==> nginx site"
cp "$HERE/nginx-snapnkeep.conf" /etc/nginx/sites-available/snapnkeep
ln -sf /etc/nginx/sites-available/snapnkeep /etc/nginx/sites-enabled/snapnkeep
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Health check"
sleep 2
if curl -fsS http://127.0.0.1:8080/api/v2/health; then
  echo
  echo "OK — Snapnkeep v2 installed. Guest UI: http://<this-device-ip>/  Console: http://<this-device-ip>/admin"
else
  echo
  echo "Server did not answer. Inspect with: sudo -u $APP_USER $PM2 logs snapnkeep-server"
  exit 1
fi
