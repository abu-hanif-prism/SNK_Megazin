#!/usr/bin/env bash
# Builds a fully self-contained release tarball for the Ubuntu devices.
# Run this on your laptop WITH internet (home/office). The tarball needs no
# internet to install: it bundles the Node 24 runtime, the server with
# linux-x64 native modules, the built UI, pm2, and the install script.
#
# Usage: ./build-release.sh
# Output: deploy/releases/snapnkeep-v2-<timestamp>.tar.gz
set -euo pipefail

NODE_VERSION="24.12.0" # keep in lockstep with the ABI of your dev machine's node
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$REPO/deploy"
STAGING="$DEPLOY/staging"
CACHE="$DEPLOY/cache"
STAMP="$(date +%Y%m%d-%H%M)"

echo "==> 1/6 building UI"
(cd "$REPO/ui" && npx next build)  # static export → ui/out

echo "==> 2/6 staging server with linux-x64 production dependencies"
# (retry: Spotlight indexing fresh node_modules can race rm on macOS)
rm -rf "$STAGING" 2>/dev/null || { sleep 2; rm -rf "$STAGING"; }
mkdir -p "$STAGING/server" "$STAGING/ui" "$STAGING/pm2" "$CACHE" "$DEPLOY/releases"
rsync -a "$REPO/server/" "$STAGING/server/" \
  --exclude node_modules --exclude public --exclude ".env" \
  --exclude "*.sqlite3*" --exclude "smoke-test-*"
(
  cd "$STAGING/server"
  npm ci --omit=dev
  # swap native binaries for linux-x64 ones (npm 11 dropped npm_config_platform
  # forwarding, so we call prebuild-install explicitly per native module)
  cd node_modules/better-sqlite3
  npx prebuild-install --platform=linux --arch=x64 --target="$NODE_VERSION"
)

echo "==> verifying native modules are linux binaries"
SQLITE_NODE="$STAGING/server/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
if ! file "$SQLITE_NODE" | grep -q "ELF 64-bit"; then
  echo "FATAL: better_sqlite3.node is not a linux binary:"
  file "$SQLITE_NODE"
  exit 1
fi

echo "==> 3/6 staging built UI"
rsync -a "$REPO/ui/out/" "$STAGING/ui/"

echo "==> 4/6 bundling pm2 (pure JS, platform independent)"
(
  cd "$STAGING/pm2"
  printf '{"name":"snapnkeep-pm2-bundle","private":true,"dependencies":{"pm2":"^5.4.0"}}' > package.json
  npm install --omit=dev --no-audit --no-fund >/dev/null
)

echo "==> 5/6 bundling Node ${NODE_VERSION} linux-x64 runtime"
NODE_TARBALL="node-v${NODE_VERSION}-linux-x64.tar.xz"
if [ ! -f "$CACHE/$NODE_TARBALL" ]; then
  curl -fL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}" -o "$CACHE/$NODE_TARBALL"
fi
cp "$CACHE/$NODE_TARBALL" "$STAGING/"

echo "==> 6/6 packing release"
cp "$DEPLOY/install.sh" "$DEPLOY/ecosystem.config.cjs" "$DEPLOY/nginx-snapnkeep.conf" "$DEPLOY/check-device.sh" "$STAGING/"
cp "$REPO/server/.env.example" "$STAGING/env.example"
OUT="$DEPLOY/releases/snapnkeep-v2-${STAMP}.tar.gz"
tar -czf "$OUT" -C "$STAGING" .
rm -rf "$STAGING"

echo
echo "Release ready: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Next: ./deploy-all.sh $OUT   (or scp it to one device and run install.sh there)"
