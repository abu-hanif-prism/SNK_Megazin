#!/usr/bin/env bash
# Ships a release to every device in devices.txt and runs the installer.
# Runs from your laptop on the devices' LAN — no internet needed.
#
# Usage: ./deploy-all.sh releases/snapnkeep-v2-<stamp>.tar.gz [devices.txt]
set -euo pipefail

RELEASE="${1:?usage: ./deploy-all.sh <release.tar.gz> [devices-file]}"
DEVICES_FILE="${2:-$(dirname "$0")/devices.txt}"
SSH_USER="snapnkeep"

[ -f "$RELEASE" ] || { echo "release not found: $RELEASE"; exit 1; }
[ -f "$DEVICES_FILE" ] || { echo "device list not found: $DEVICES_FILE (copy devices.example.txt)"; exit 1; }

FAILED=()
while IFS= read -r ip; do
  [[ -z "$ip" || "$ip" == \#* ]] && continue
  echo
  echo "=================================================="
  echo "== $ip"
  echo "=================================================="
  if scp -o ConnectTimeout=8 "$RELEASE" "$SSH_USER@$ip:/tmp/snapnkeep-release.tar.gz" &&
    ssh -o ConnectTimeout=8 "$SSH_USER@$ip" '
      set -e
      rm -rf /tmp/snapnkeep-release
      mkdir -p /tmp/snapnkeep-release
      tar -xzf /tmp/snapnkeep-release.tar.gz -C /tmp/snapnkeep-release
      sudo bash /tmp/snapnkeep-release/install.sh
    '; then
    echo "== $ip OK"
  else
    echo "== $ip FAILED"
    FAILED+=("$ip")
  fi
done < "$DEVICES_FILE"

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "All devices updated."
else
  echo "FAILED devices: ${FAILED[*]}"
  exit 1
fi
