// Response shaping (DB row -> API JSON) + the frame-upload multer config.
import multer from "multer";
import path from "node:path";
import { config } from "../config.js";
import { getFramesForSession, getBannedNames } from "./sessions.model.js";
import { countPrintRows } from "../prints/prints.model.js";

export const frameUpload = multer({
  dest: path.join(config.framesDir, ".tmp"),
  limits: { fileSize: config.uploadLimitBytes },
});

export function frameJson(f) {
  const base = `/frames/${f.session_id}`;
  return {
    id: f.id,
    orientation: f.orientation,
    url: `${base}/${f.file_name}`,
    previewUrl: `${base}/${f.preview_name}`,
    position: f.position,
  };
}

export function sessionJson(s, { withCounts = false } = {}) {
  const frames = getFramesForSession(s.id).map(frameJson);
  const json = {
    id: s.id,
    clientName: s.client_name,
    eventDate: s.event_date,
    userMaxPrintCount: s.user_max_print_count,
    sessionPrintThreshold: s.session_print_threshold,
    breakMode: !!s.break_mode,
    queuePaused: !!s.queue_paused,
    frames: {
      vertical: frames.filter((f) => f.orientation === "vertical"),
      horizontal: frames.filter((f) => f.orientation === "horizontal"),
    },
  };
  if (withCounts) {
    json.printCount = countPrintRows(s.id);
    json.bannedNames = getBannedNames(s.id);
  }
  return json;
}
