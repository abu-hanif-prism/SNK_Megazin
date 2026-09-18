// Single database connection + schema. better-sqlite3 is synchronous, which
// keeps every handler simple straight-line code.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

fs.mkdirSync(config.framesDir, { recursive: true });
fs.mkdirSync(config.printsDir, { recursive: true });

export const db = new Database(config.dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  client_name             TEXT NOT NULL,
  event_date              TEXT,
  user_max_print_count    INTEGER NOT NULL DEFAULT 5,   -- 0 = unlimited
  session_print_threshold INTEGER NOT NULL DEFAULT 200, -- 0 = unlimited
  break_mode              INTEGER NOT NULL DEFAULT 0,
  queue_paused            INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frames (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  orientation TEXT NOT NULL CHECK (orientation IN ('vertical','horizontal')),
  file_name    TEXT NOT NULL, -- full-res PNG (client compositor input)
  preview_name TEXT NOT NULL, -- small WebP for browsing (admin browser generates)
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bans (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  PRIMARY KEY (session_id, name)
);

CREATE TABLE IF NOT EXISTS prints (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_id      TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  layout         TEXT,
  effect         TEXT,
  frame_id       INTEGER,
  copies         INTEGER NOT NULL DEFAULT 1,
  rating         INTEGER NOT NULL DEFAULT 0,
  -- queue state machine: queued -> submitted -> printing -> completed
  --                      queued -> canceled | failed | needs_attention
  status         TEXT NOT NULL DEFAULT 'queued',
  queue_position INTEGER,
  cups_job_id    TEXT,
  error          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  printed_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_prints_session_status ON prints(session_id, status);
`);

// --- settings helpers -------------------------------------------------------
export function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, String(value));
}

// --- first-boot seeding ------------------------------------------------------
if (!getSetting("jwt_secret")) {
  setSetting("jwt_secret", crypto.randomBytes(32).toString("hex"));
}
if (!getSetting("admin_password_hash")) {
  setSetting("admin_password_hash", bcrypt.hashSync(config.auth.initialAdminPassword, 10));
  console.log("Seeded initial admin password (change it from the console).");
}

export function touch(table, id) {
  db.prepare(`UPDATE ${table} SET updated_at = datetime('now') WHERE id = ?`).run(id);
}

export function activeSessionId() {
  const v = getSetting("active_session_id");
  return v ? Number(v) : null;
}

export function activeSession() {
  const id = activeSessionId();
  if (!id) return null;
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) || null;
}
