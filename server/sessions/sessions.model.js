// All raw SQL for the sessions, frames, and bans tables.
import { db } from "../db.js";

export function getSessionById(id) {
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
}

export function listSessions() {
  return db.prepare("SELECT * FROM sessions ORDER BY event_date ASC, id ASC").all();
}

export function insertSession({ clientName, eventDate, userMaxPrintCount, sessionPrintThreshold }) {
  const info = db
    .prepare(
      `INSERT INTO sessions (client_name, event_date, user_max_print_count, session_print_threshold)
       VALUES (?, ?, ?, ?)`
    )
    .run(clientName, eventDate, userMaxPrintCount, sessionPrintThreshold);
  return getSessionById(info.lastInsertRowid);
}

export function updateSessionRow(
  id,
  { clientName, eventDate, userMaxPrintCount, sessionPrintThreshold, breakMode, queuePaused }
) {
  db.prepare(
    `UPDATE sessions SET
       client_name = ?, event_date = ?, user_max_print_count = ?,
       session_print_threshold = ?, break_mode = ?, queue_paused = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(clientName, eventDate, userMaxPrintCount, sessionPrintThreshold, breakMode, queuePaused, id);
  return getSessionById(id);
}

export function deleteSessionRow(id) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id); // cascades frames/bans/prints
}

export function getFramesForSession(sessionId) {
  return db
    .prepare("SELECT * FROM frames WHERE session_id = ? ORDER BY orientation, position, id")
    .all(sessionId);
}

export function maxFramePosition(sessionId, orientation) {
  return db
    .prepare("SELECT COALESCE(MAX(position), 0) AS m FROM frames WHERE session_id = ? AND orientation = ?")
    .get(sessionId, orientation).m;
}

export function insertFrameStub(sessionId, orientation, position) {
  const info = db
    .prepare(
      "INSERT INTO frames (session_id, orientation, file_name, preview_name, position) VALUES (?, ?, '', '', ?)"
    )
    .run(sessionId, orientation, position);
  return info.lastInsertRowid;
}

export function updateFrameFiles(id, fileName, previewName) {
  db.prepare("UPDATE frames SET file_name = ?, preview_name = ? WHERE id = ?").run(fileName, previewName, id);
}

export function getFrameById(id) {
  return db.prepare("SELECT * FROM frames WHERE id = ?").get(id);
}

export function getFrameByIdForSession(id, sessionId) {
  return db.prepare("SELECT * FROM frames WHERE id = ? AND session_id = ?").get(id, sessionId);
}

export function deleteFrameRow(id) {
  db.prepare("DELETE FROM frames WHERE id = ?").run(id);
}

export function getBannedNames(sessionId) {
  return db
    .prepare("SELECT name FROM bans WHERE session_id = ?")
    .all(sessionId)
    .map((b) => b.name);
}

export function isNameBanned(sessionId, name) {
  return !!db
    .prepare("SELECT 1 FROM bans WHERE session_id = ? AND name = ? COLLATE NOCASE")
    .get(sessionId, name);
}

export function insertBan(sessionId, name) {
  db.prepare("INSERT OR IGNORE INTO bans (session_id, name) VALUES (?, ?)").run(sessionId, name);
}

export function deleteBan(sessionId, name) {
  db.prepare("DELETE FROM bans WHERE session_id = ? AND name = ?").run(sessionId, name);
}
