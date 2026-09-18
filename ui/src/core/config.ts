// API base resolution: production is same-origin behind nginx; `next dev`
// (port 3000) talks to the dev backend on :8080.
export const API_BASE =
  typeof location !== "undefined" && location.port === "3000"
    ? `http://${location.hostname}:8080`
    : "";

export const api = (path: string) => `${API_BASE}/api/v2${path}`;
export const asset = (path: string) => `${API_BASE}${path}`;
