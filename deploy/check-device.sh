#!/usr/bin/env bash
# Diagnostics — run on a device (or: ssh snapnkeep@<ip> 'bash -s' < check-device.sh)
echo "=== OS ==="; lsb_release -d 2>/dev/null || cat /etc/os-release | head -2
echo "=== node ==="; node -v 2>/dev/null || echo "not installed"
echo "=== pm2 ==="; /home/snapnkeep/servers/v2/pm2/node_modules/.bin/pm2 status 2>/dev/null || echo "v2 pm2 not installed"
echo "=== ports ==="; ss -ltnp 2>/dev/null | grep -E ':(80|8080|4000|3001)\s' || echo "nothing on 80/8080/4000/3001"
echo "=== printer ==="; lpstat -p -d 2>/dev/null || echo "CUPS not answering"
echo "=== cups queue ==="; lpstat -o 2>/dev/null || echo "(empty)"
echo "=== disk ==="; df -h / | tail -1
echo "=== health ==="; curl -fsS -m 3 http://127.0.0.1:8080/api/v2/health 2>/dev/null && echo || echo "server not answering"
