# Snapnkeep Mini v2 — deployment

The devices have **no internet**, so a release is a fully self-contained
tarball: Node 24 runtime + server with linux-x64 native modules + built UI +
pm2 + install script. Build it once where you have internet; ship it over the
LAN from your laptop.

## One-time setup
```bash
cp deploy/devices.example.txt deploy/devices.txt   # fill in real device IPs
```
SSH key access to `snapnkeep@<device>` (with sudo) is assumed.

## Release + deploy
```bash
cd deploy
./build-release.sh                                  # needs internet, ~2 min
./deploy-all.sh releases/snapnkeep-v2-<stamp>.tar.gz  # LAN only
```
Single device instead of the fleet:
```bash
scp releases/snapnkeep-v2-<stamp>.tar.gz snapnkeep@<ip>:/tmp/r.tar.gz
ssh snapnkeep@<ip> 'mkdir -p /tmp/r && tar xzf /tmp/r.tar.gz -C /tmp/r && sudo bash /tmp/r/install.sh'
```

## What install.sh does (idempotent, safe to re-run)
1. Installs bundled Node 24 to `/usr/local` (skips if present).
2. Syncs code to `/home/snapnkeep/servers/v2/` — **preserves** `.env`, the
   sqlite database, `public/frames/`, `public/prints/`.
3. Kills legacy processes on ports 8080/4000/3001.
4. Starts `snapnkeep-server` under pm2 (bundled), `pm2 save` + systemd
   startup hook so it survives reboots/power cuts.
5. Installs the nginx site (static UI at `/`, proxy `/api` + `/socket.io`
   to :8080) and reloads nginx.
6. Health-checks `GET /api/v2/health`.

## Mid-event hotfix (the old workflow, kept alive)
The server is plain JS with no build step:
```bash
ssh snapnkeep@<ip>
nano /home/snapnkeep/servers/v2/server/<file>.js
/home/snapnkeep/servers/v2/pm2/node_modules/.bin/pm2 restart snapnkeep-server
```

## Ops cheatsheet
```bash
PM2=/home/snapnkeep/servers/v2/pm2/node_modules/.bin/pm2
$PM2 status | logs snapnkeep-server | restart snapnkeep-server
bash check-device.sh          # full device diagnostic
```

Console password: seeded from `INITIAL_ADMIN_PASSWORD` in
`/home/snapnkeep/servers/v2/server/.env` on first boot — change it from
Console → Settings afterwards. JWT secret is generated per-device.

Legacy stack: files under the old paths are untouched; only its processes are
stopped and nginx now points at v2.
