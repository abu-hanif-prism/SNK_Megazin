# Legacy Snapnkeep Mini — Behavioral Reference

Captured 2026-07-10 from the running system (`api/` + `UIv2/`). This is the
behavior the rewrite must preserve **from the end user's point of view**.
Internal mechanics are documented so we know what we're replacing, not to be
copied.

## Processes (legacy)

| Process | Port | Role |
|---|---|---|
| Angular SSR (`UIv2` dist) | 4000 | serves UI (`/` via nginx) |
| Express API (`api/app.js`) | 8080 | REST + socket.io + static `public/` |
| Puppeteer service (`api/browser.js`) | 3001 | `POST /screenshot/:id` → screenshots `/api/v1/render/:id` |

nginx (port 80): `/` → 4000, `/api` + `/socket.io` → 8080, `/frames|/raw|/prints`
static (per `nginx.config`; `NGINX_HANDLE_STATIC=false` means node serves them).

## REST API (legacy contract)

Auth: JWT Bearer. Login `POST /api/v1/auth` `{username, password}` → `{token}`
(hardcoded creds `awesomeadmin`/`papermoney98523`, JWT_LIFETIME 30d).

| Method & path | Auth | Behavior |
|---|---|---|
| GET `/api/v1/` | no | Counter row `_id=0` incl. active `Session` (frames as JSON strings, bannedNames JSON string, breakMode, limits, ratingCounts). UI boots from this. |
| POST `/api/v1/print` | **no** | multipart: `rawImg` file + `layout`(layout1/layout2), `effect`(normal/warm/grayscale), `scale`, `marginTop`, `marginLeft` (percent numbers), `mnemonicLink`(frame path), `clientID`(guest name). Saves raw → creates Print → Puppeteer render 1000x1500/1500x1000 PNG → `lp <file>` → jobID regex-parsed. Returns Print JSON (incl `_id`, `url`). Increments Counter.totalPrints + Session.printCount. |
| PUT `/api/v1/print/:id` | no | body merge-update; if `rating` present, adjusts ratingCountN on Counter AND Session (decrements old rating bucket, increments new). Used by guest rating stars. |
| DELETE `/api/v1/print/:id` | yes | destroys row |
| DELETE `/api/v1/print/reprint/:id` | yes | BROKEN (invalid `findByPk().include()`) — dead code; console uses socket instead |
| GET `/api/v1/session` | yes | all sessions, ordered by date ASC |
| POST `/api/v1/session` | yes | multipart fields `v[]`,`h[]` frame files + `clientName`, `userMaxPrintCount`, `sessionPrintThreshold`, `date`. clientName spaces→underscores. Frames renamed to `<index><origExt>` under `public/frames/<client>/{vertical,horizontal}/`. Stores frame ranges as JSON strings `{rootPath, stIdx:0, endIdx:n-1}` (endIdx=-1 when none). |
| PUT `/api/v1/session/:id` | yes | merge update |
| DELETE `/api/v1/session/:id` | yes | destroy (frame files NOT deleted) |
| GET `/api/v1/session/makeActive/:id` | yes | sets Counter.session = id |
| GET `/api/v1/session/getPrints/:id` | yes | prints for session, createdAt ASC |
| PATCH `/api/v1/session/ban/:id` `{name}` | yes | push into bannedNames JSON |
| PATCH `/api/v1/session/unban/:id` `{name}` | yes | remove from bannedNames |
| GET `/api/v1/session/toggleBreakMode/:id` | yes | flip breakMode |
| GET `/api/v1/render/:id` | no | EJS page reproducing composition (Puppeteer target) |

## Socket.io (legacy)

- No auth on any event.
- Server → all clients every 2.5 s (only if clients connected): `printUpdates`
  `{prints: [all prints of active session, createdAt ASC], jobs: [running CUPS jobIDs]}`.
  (`jobs` from `lpstat -o` parsing, prefix `G1020USB-` stripped; disabled on the
  dev machine, enabled on devices.)
- Client → server: `reprint {jobID, id}` (`lp -i <jobID> -H restart` + copies+1),
  `retry jobID` (same restart), `cancel jobID` (`cancel <id>`), `deletePrint id`.

## Guest flow (MUST look/feel identical)

1. **Splash/Welcome** (rendered by header component, blocks scroll): logo,
   session-agnostic welcome, one Upload button (native file input, images only).
   Splash hides ~510 ms after a photo is picked.
2. **Editor** (home page): photo shown inside frame preview (320 px wide basis;
   layout1 320x480, layout2 320x213.33). Orientation auto-picks layout
   (landscape→layout2, portrait→layout1, falls back if that orientation has no
   frames). Pan via Hammer.js pan (margins as % of the 320-basis box), zoom via
   pinch (scale, initial 1.5). "Drag to reposition" hint overlay. Frame
   carousel arrows (wraps around) shown only if >1 frame for the orientation.
   Options accordion: Layouts (only orientations that have frames), Effects
   (normal/grayscale/warm previews). "Print Image" + "Change Image" buttons.
3. **Confirm modal** (fullscreen PrimeNG dialog): live preview repeat + name
   input (placeholder "Enter Name/Email") shown only if no `clientID` in
   localStorage; Confirm disabled until name ≥ 3 chars.
4. **Printing state**: frame slides down (`slideDown-d3`), loading GIF overlay,
   toast "Your image is in the print queue and will be printed shortly." (6.5 s),
   download button (fetches rendered print PNG), 5-star rating ("Did you like
   it?") that PUTs rating, "Print Another Image?" link → reload `/`.
5. **Gates**: breakMode → `/break` page; localStorage per-session print count ≥
   userMaxPrintCount (when >0) → `/max-count-reached`; clientID in bannedNames →
   `/max-count-reached`. ALL CLIENT-SIDE in legacy (rewrite: server-enforced).

localStorage keys: `clientID` (guest name), `<sessionName>PrintCount`,
`userData` (admin JWT wrapper).

## Admin console flow

`/login` (username/password → JWT) → `/console`: tabs (PrimeNG TabView) with
prints list (preview, client, copies, rating, status Pending/Completed derived
from jobs list, retry/reprint/cancel/delete via socket), per-name print counts +
total, session CRUD dialog (name, limits, date, vertical/horizontal frame file
pickers), activate session, ban/unban names, break-mode toggle. `/slideshow`:
swiper of prints (hardcoded to session 1 — broken/legacy).

## Quirks that are BUGS (not to preserve)

- reprint REST route broken; slideshow hardcoded session; frames with non-png
  extensions 404 in UI (generateImagePaths assumes `.png`); 3 Sequelize
  instances; limits/bans enforced client-side only; unauthenticated socket
  actions & print POST; no cleanup of raw/prints; rating math never persists
  print row before counter math; `jobs=[]` debug leftover on dev machine.

## Print-quality contract

4x6 inch paper, Canon G1020, borderless. Legacy render 1000x1500 (~250 DPI).
Rewrite target: 1200x1800 (300 DPI) composited client-side; golden renders in
`golden-renders/` define expected visual output for identical inputs.
