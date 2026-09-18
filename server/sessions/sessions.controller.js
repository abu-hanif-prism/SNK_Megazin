// Session management (admin) + the public "what event am I at" endpoint that
// boots the guest UI. Frames are DB rows: the admin browser uploads each
// frame as full-res PNG + a small WebP preview it generates itself, so the
// server never processes images.
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { activeSession, activeSessionId, setSetting } from "../db.js";
import { emitQueueUpdate } from "../realtime.js";
import { countQueueLength } from "../prints/prints.model.js";
import {
  getSessionById,
  listSessions,
  insertSession,
  updateSessionRow,
  deleteSessionRow,
  maxFramePosition,
  insertFrameStub,
  updateFrameFiles,
  getFrameById,
  getFrameByIdForSession,
  deleteFrameRow,
  insertBan,
  deleteBan,
} from "./sessions.model.js";
import { sessionJson, frameJson } from "./sessions.utils.js";

// --- public: guest boot ------------------------------------------------------
export function getPublicSession(req, res) {
  const session = activeSession();
  if (!session) return res.status(404).json({ error: "No active session" });
  const json = sessionJson(session);
  json.queueLength = countQueueLength(session.id);
  res.json(json);
}

// --- admin: session CRUD -----------------------------------------------------
export function listAllSessions(req, res) {
  res.json({
    activeSessionId: activeSessionId(),
    sessions: listSessions().map((s) => sessionJson(s, { withCounts: true })),
  });
}

export function createSession(req, res) {
  const { clientName, eventDate, userMaxPrintCount, sessionPrintThreshold } = req.body || {};
  if (!clientName?.trim()) return res.status(400).json({ error: "clientName is required" });
  const session = insertSession({
    clientName: clientName.trim(),
    eventDate: eventDate || null,
    userMaxPrintCount: Number(userMaxPrintCount ?? 5),
    sessionPrintThreshold: Number(sessionPrintThreshold ?? 200),
  });
  res.status(201).json(sessionJson(session));
}

export function updateSession(req, res) {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const { clientName, eventDate, userMaxPrintCount, sessionPrintThreshold, breakMode, queuePaused } =
    req.body || {};
  const updated = updateSessionRow(session.id, {
    clientName: clientName?.trim() || session.client_name,
    eventDate: eventDate ?? session.event_date,
    userMaxPrintCount: Number(userMaxPrintCount ?? session.user_max_print_count),
    sessionPrintThreshold: Number(sessionPrintThreshold ?? session.session_print_threshold),
    breakMode: breakMode === undefined ? session.break_mode : breakMode ? 1 : 0,
    queuePaused: queuePaused === undefined ? session.queue_paused : queuePaused ? 1 : 0,
  });
  if (queuePaused !== undefined) emitQueueUpdate();
  res.json(sessionJson(updated));
}

export function deleteSession(req, res) {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  deleteSessionRow(session.id); // cascades frames/bans/prints
  // remove files
  for (const dir of [
    path.join(config.framesDir, String(session.id)),
    path.join(config.printsDir, String(session.id)),
  ]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (activeSessionId() === session.id) setSetting("active_session_id", "");
  res.json({ ok: true });
}

export function activateSession(req, res) {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  setSetting("active_session_id", session.id);
  emitQueueUpdate();
  res.json({ ok: true, activeSessionId: session.id });
}

// --- admin: frames -----------------------------------------------------------
// multipart fields: file (full-res PNG), preview (small WebP), orientation
export function uploadFrame(req, res) {
  const session = getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const { orientation } = req.body || {};
  if (!["vertical", "horizontal"].includes(orientation)) {
    return res.status(400).json({ error: "orientation must be vertical|horizontal" });
  }
  if (!req.files?.file?.[0] || !req.files?.preview?.[0]) {
    return res.status(400).json({ error: "file and preview are both required" });
  }

  const dir = path.join(config.framesDir, String(session.id));
  fs.mkdirSync(dir, { recursive: true });
  const position = maxFramePosition(session.id, orientation) + 1;

  const id = insertFrameStub(session.id, orientation, position);
  const fileName = `${id}.png`;
  // admin browsers that can't encode webp send png/jpeg previews instead
  const previewExt =
    { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" }[req.files.preview[0].mimetype] || "webp";
  const previewName = `${id}.preview.${previewExt}`;
  fs.renameSync(req.files.file[0].path, path.join(dir, fileName));
  fs.renameSync(req.files.preview[0].path, path.join(dir, previewName));
  updateFrameFiles(id, fileName, previewName);

  res.status(201).json(frameJson(getFrameById(id)));
}

export function deleteFrame(req, res) {
  const frame = getFrameByIdForSession(req.params.frameId, req.params.id);
  if (!frame) return res.status(404).json({ error: "Frame not found" });
  deleteFrameRow(frame.id);
  const dir = path.join(config.framesDir, String(frame.session_id));
  for (const f of [frame.file_name, frame.preview_name]) {
    fs.rmSync(path.join(dir, f), { force: true });
  }
  res.json({ ok: true });
}

// --- admin: bans -------------------------------------------------------------
export function addBan(req, res) {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  insertBan(req.params.id, name.trim());
  res.json({ ok: true });
}

export function removeBan(req, res) {
  deleteBan(req.params.id, req.params.name);
  res.json({ ok: true });
}
