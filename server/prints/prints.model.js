// All raw SQL for the prints table (this table doubles as the print queue —
// see prints.controller.js for the state machine built on top of it).
import { db } from "../db.js";

const IN_FLIGHT_STATUSES = ["submitted"];

export function getPrintById(id) {
  return db.prepare("SELECT * FROM prints WHERE id = ?").get(id);
}

export function listPrintsForSession(sessionId) {
  return db.prepare("SELECT * FROM prints WHERE session_id = ? ORDER BY created_at ASC, id ASC").all(sessionId);
}

export function countPrintRows(sessionId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM prints WHERE session_id = ? AND status != 'canceled'")
    .get(sessionId).n;
}

export function countQueueLength(sessionId) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM prints WHERE session_id = ? AND status IN ('queued','submitted')")
    .get(sessionId).n;
}

export function countPrintsBy(sessionId, clientId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(copies), 0) AS n FROM prints
       WHERE session_id = ? AND client_id = ? COLLATE NOCASE AND status != 'canceled'`
    )
    .get(sessionId, clientId).n;
}

export function totalPrintsForSession(sessionId) {
  return db
    .prepare("SELECT COALESCE(SUM(copies),0) AS n FROM prints WHERE session_id = ? AND status != 'canceled'")
    .get(sessionId).n;
}

export function insertPrint({ sessionId, clientId, layout, effect, frameId }) {
  const info = db
    .prepare(
      `INSERT INTO prints (session_id, client_id, file_name, layout, effect, frame_id, status)
       VALUES (?, ?, '', ?, ?, ?, 'queued')`
    )
    .run(sessionId, clientId, layout, effect, frameId);
  return info.lastInsertRowid;
}

export function updatePrintFileName(id, fileName) {
  db.prepare("UPDATE prints SET file_name = ? WHERE id = ?").run(fileName, id);
}

export function updatePrintRating(id, rating) {
  db.prepare("UPDATE prints SET rating = ?, updated_at = datetime('now') WHERE id = ?").run(rating, id);
}

export function deletePrintRow(id) {
  db.prepare("DELETE FROM prints WHERE id = ?").run(id);
}

export function statsByClient(sessionId) {
  return db
    .prepare(
      `SELECT client_id AS name, SUM(copies) AS prints FROM prints
       WHERE session_id = ? AND status != 'canceled'
       GROUP BY client_id COLLATE NOCASE ORDER BY prints DESC`
    )
    .all(sessionId);
}

export function statsByStatus(sessionId) {
  return db.prepare("SELECT status, COUNT(*) AS n FROM prints WHERE session_id = ? GROUP BY status").all(sessionId);
}

export function statsRatings(sessionId) {
  return db
    .prepare(
      `SELECT rating, COUNT(*) AS n FROM prints
       WHERE session_id = ? AND rating > 0 GROUP BY rating`
    )
    .all(sessionId);
}

// --- queue state (same table; see prints.controller.js for the state machine)
export function queuedPrints(sessionId) {
  return db
    .prepare(
      `SELECT * FROM prints WHERE session_id = ? AND status = 'queued'
       ORDER BY queue_position ASC, id ASC`
    )
    .all(sessionId);
}

/** Derived queue position (1-based) for a queued print; 0 if not queued. */
export function queuePositionOf(printId) {
  const print = getPrintById(printId);
  if (!print || print.status !== "queued") return 0;
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS ahead FROM prints
         WHERE session_id = ? AND status = 'queued'
           AND (queue_position < ? OR (queue_position = ? AND id < ?))`
      )
      .get(print.session_id, print.queue_position, print.queue_position, print.id).ahead + 1
  );
}

export function maxQueuePosition() {
  return db.prepare("SELECT COALESCE(MAX(queue_position), 0) AS m FROM prints WHERE status = 'queued'").get().m;
}

export function setQueued(id, position) {
  db.prepare(
    "UPDATE prints SET status = 'queued', queue_position = ?, error = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(position, id);
}

export function setQueuePositions(orderedIds) {
  const setPos = db.prepare(
    "UPDATE prints SET queue_position = ?, updated_at = datetime('now') WHERE id = ? AND status = 'queued'"
  );
  db.transaction(() => {
    orderedIds.forEach((id, i) => setPos.run(i + 1, id));
  })();
}

export function setCanceled(id) {
  db.prepare("UPDATE prints SET status = 'canceled', updated_at = datetime('now') WHERE id = ?").run(id);
}

export function markCompleted(id) {
  db.prepare(
    "UPDATE prints SET status = 'completed', printed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}

export function markSubmitted(id, jobId) {
  db.prepare(
    "UPDATE prints SET status = 'submitted', cups_job_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(jobId, id);
}

export function markFailed(id, errorMessage) {
  db.prepare("UPDATE prints SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?").run(
    errorMessage,
    id
  );
}

export function incrementCopies(id) {
  db.prepare("UPDATE prints SET copies = copies + 1 WHERE id = ?").run(id);
}

export function listInFlight() {
  return db
    .prepare(`SELECT * FROM prints WHERE status IN (${IN_FLIGHT_STATUSES.map(() => "?").join(",")})`)
    .all(...IN_FLIGHT_STATUSES);
}

export function countInFlight() {
  return db
    .prepare(`SELECT COUNT(*) AS n FROM prints WHERE status IN (${IN_FLIGHT_STATUSES.map(() => "?").join(",")})`)
    .get(...IN_FLIGHT_STATUSES).n;
}

/** Boot recovery: jobs handed to CUPS before a crash/restart are ambiguous —
 * flag them for one-tap admin triage instead of blindly reprinting. */
export function recoverInFlightToNeedsAttention() {
  return db
    .prepare(
      `UPDATE prints SET status = 'needs_attention', updated_at = datetime('now'),
       error = 'in printer buffer during restart — verify if it printed'
       WHERE status IN ('submitted')`
    )
    .run().changes;
}
