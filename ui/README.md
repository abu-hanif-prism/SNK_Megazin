# Snapnkeep UI (Next.js)

Guest print flow (`/`) and staff console (`/admin`). Next.js App Router,
exported as static files (`output: "export"`) — the devices only run nginx +
the API, so there is no Node process for the UI.

```bash
npm install
npm run dev      # http://localhost:3000 — talks to the API on :8080
npm run build    # static site in out/  (deploy/build-release.sh ships this)
```

`next dev` needs the backend running (`cd ../server && npm run dev`); the UI
calls it on port 8080 automatically when served from port 3000. In production
everything is same-origin behind nginx.

## Layout
```
src/app/          routes: / (print flow), /break, /limit, /admin, /admin/login
                  (+ redirects for legacy URLs: /max-count-reached, /console, /login)
src/print-flow/   flow state, preview, gestures, client-side compositor
src/steps/        welcome → editor → confirm → printing
src/admin/        console shell, login, queue/prints/sessions/settings tabs
src/core/         API client, models, toasts
public/           fonts, images, favicon (copied as-is)
```

Styles are plain SCSS. Each component's stylesheet is nested under a root class
(`.snk-editor-step { … }`) so it stays scoped to that component.
