// Guest print submission + status, admin queue operations, and the print
// queue state machine / CUPS feeder loop.
//
// The uploaded file IS the final print (composed client-side at 2480x3508 /
// 3508x2480) — the server validates and queues it, nothing more.
//
// State machine:
//   queued ──feeder──▶ submitted ──lpstat──▶ completed
//   queued ──admin───▶ canceled
//   submitted ──lp fails──▶ failed
//   submitted at crash/boot ──▶ needs_attention (sheet may or may not exist)
import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { config } from "../config.js";
import { activeSession } from "../db.js";
import { isAdminRequest } from "../auth/auth.utils.js";
import { isNameBanned } from "../sessions/sessions.model.js";
import { emitQueueUpdate } from "../realtime.js";
import * as cups from "../cups.js";
import * as model from "./prints.model.js";
import { printJson, printFilePath, validatePrintDimensions } from "./prints.utils.js";

// --- guest submission + status ------------------------------------------------
// multipart: image (final composed print) + clientId, layout, effect, frameId
export function submitPrint(req, res) {
  const cleanup = () => req.file && fs.rmSync(req.file.path, { force: true });

  const session = activeSession();
  if (!session) { cleanup(); return res.status(409).json({ error: "No active session", code: "NO_SESSION" }); }
  if (session.break_mode) { cleanup(); return res.status(403).json({ error: "Printing is paused", code: "BREAK_MODE" }); }

  const { clientId, layout, effect, frameId } = req.body || {};
  const name = clientId?.trim();
  if (!name || name.length < 3) { cleanup(); return res.status(400).json({ error: "clientId (min 3 chars) is required", code: "BAD_NAME" }); }
  if (!req.file) { return res.status(400).json({ error: "image file is required", code: "NO_IMAGE" }); }

  // server-side enforcement — an admin printing from this device (e.g.
  // testing) is exempt from bans and quotas, since those exist to police
  // guests, not staff.
  if (!isAdminRequest(req)) {
    if (isNameBanned(session.id, name)) {
      cleanup();
      return res.status(403).json({ error: "Printing limit reached", code: "BANNED" });
    }

    if (session.session_print_threshold > 0) {
      if (model.totalPrintsForSession(session.id) >= session.session_print_threshold) {
        cleanup();
        return res.status(403).json({ error: "Event print limit reached", code: "SESSION_LIMIT" });
      }
    }
    if (session.user_max_print_count > 0 && model.countPrintsBy(session.id, name) >= session.user_max_print_count) {
      cleanup();
      return res.status(403).json({ error: "You have reached your print limit", code: "USER_LIMIT" });
    }
  }

  // validate the composed image dimensions (A4 ratio at usable resolution)
  let dim;
  try {
    dim = imageSize(fs.readFileSync(req.file.path));
  } catch {
    cleanup();
    return res.status(400).json({ error: "Unreadable image", code: "BAD_IMAGE" });
  }
  const dimCheck = validatePrintDimensions(dim);
  if (!dimCheck.ok) {
    cleanup();
    return res.status(400).json({ error: dimCheck.message, code: "BAD_DIMENSIONS" });
  }

  const ext = dim.type === "png" ? "png" : "jpg";
  const id = model.insertPrint({
    sessionId: session.id,
    clientId: name,
    layout: layout || null,
    effect: effect || null,
    frameId: frameId ? Number(frameId) : null,
  });

  const dir = path.join(config.printsDir, String(session.id));
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${id}.${ext}`;
  fs.renameSync(req.file.path, path.join(dir, fileName));
  model.updatePrintFileName(id, fileName);

  enqueue(id);
  const print = model.getPrintById(id);
  res.status(201).json(printJson(print, { withPosition: true }));
}

// guest polls their print's progress
export function getPrint(req, res) {
  const print = model.getPrintById(req.params.id);
  if (!print) return res.status(404).json({ error: "Not found" });
  res.json(printJson(print, { withPosition: true }));
}

export function ratePrint(req, res) {
  const rating = Number(req.body?.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "rating must be 1-5" });
  const print = model.getPrintById(req.params.id);
  if (!print) return res.status(404).json({ error: "Not found" });
  model.updatePrintRating(print.id, rating);
  res.json({ ok: true, rating });
}

// --- admin ---------------------------------------------------------------------
export function listForSession(req, res) {
  const prints = model.listPrintsForSession(req.params.sessionId);
  res.json({ prints: prints.map((p) => printJson(p, { withPosition: true })) });
}

export function reorderQueue(req, res) {
  const { orderedIds } = req.body || {};
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: "orderedIds array required" });
  reorder(orderedIds.map(Number));
  res.json({ ok: true });
}

export async function cancelPrintHandler(req, res) {
  const print = await cancelPrint(Number(req.params.id));
  if (!print) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
}

export function reprintHandler(req, res) {
  const print = model.getPrintById(req.params.id);
  if (!print) return res.status(404).json({ error: "Not found" });
  reprint(print.id);
  res.json({ ok: true });
}

// resolve a needs_attention print: { action: "reprint" | "done" }
export function resolveHandler(req, res) {
  const print = model.getPrintById(req.params.id);
  if (!print) return res.status(404).json({ error: "Not found" });
  if (print.status !== "needs_attention") {
    return res.status(409).json({ error: "Print does not need attention" });
  }
  resolve(print.id, req.body?.action === "reprint" ? "reprint" : "done");
  res.json({ ok: true });
}

export async function deletePrintHandler(req, res) {
  const print = model.getPrintById(req.params.id);
  if (!print) return res.status(404).json({ error: "Not found" });
  await cancelPrint(print.id);
  model.deletePrintRow(print.id);
  fs.rmSync(printFilePath(print), { force: true });
  emitQueueUpdate();
  res.json({ ok: true });
}

// per-client counts + stats for the console
export function getStats(req, res) {
  const byClient = model.statsByClient(req.params.sessionId);
  const byStatus = model.statsByStatus(req.params.sessionId);
  const ratings = model.statsRatings(req.params.sessionId);
  res.json({ byClient, byStatus, ratings });
}

// --- queue state machine (drives the routes above + the CUPS feeder) -----------
export function enqueue(printId) {
  const position = model.maxQueuePosition() + 1;
  model.setQueued(printId, position);
  emitQueueUpdate();
}

export function reorder(orderedIds) {
  model.setQueuePositions(orderedIds);
  emitQueueUpdate();
}

export async function cancelPrint(printId) {
  const print = model.getPrintById(printId);
  if (!print) return null;
  if (print.cups_job_id) await cups.cancelJob(print.cups_job_id);
  model.setCanceled(printId);
  emitQueueUpdate();
  return print;
}

/** Admin resolves a needs_attention print: reprint it or mark it done. */
export function resolve(printId, action) {
  if (action === "reprint") {
    enqueue(printId);
  } else {
    model.markCompleted(printId);
    emitQueueUpdate();
  }
}

/** Reprint an already-completed print (one more physical copy). */
export function reprint(printId) {
  model.incrementCopies(printId);
  enqueue(printId);
}

export function recoverOnBoot() {
  const n = model.recoverInFlightToNeedsAttention();
  if (n > 0) console.log(`Boot recovery: ${n} in-flight print(s) flagged needs_attention`);
}

// --- the feeder ------------------------------------------------------------
let feeding = false;

async function tick() {
  if (feeding) return; // never overlap ticks
  feeding = true;
  try {
    const session = activeSession();
    if (!session) return;

    const running = await cups.runningJobIds();
    let changed = false;

    // 1) submitted jobs that left the CUPS queue are done
    for (const p of model.listInFlight()) {
      if (!running.includes(String(p.cups_job_id))) {
        model.markCompleted(p.id);
        changed = true;
      }
    }

    // 2) top up the CUPS buffer from the queue
    if (!session.queue_paused) {
      const slots = config.cups.maxInFlight - model.countInFlight();
      for (const p of model.queuedPrints(session.id).slice(0, Math.max(slots, 0))) {
        try {
          const jobId = await cups.submitJob(printFilePath(p));
          if (jobId) {
            model.markSubmitted(p.id, jobId);
          } else {
            model.markFailed(p.id, "lp did not return a job id");
          }
        } catch (err) {
          model.markFailed(p.id, String(err.message || err));
        }
        changed = true;
      }
    }

    if (changed) emitQueueUpdate();
  } catch (err) {
    console.error("queue tick error:", err.message);
  } finally {
    feeding = false;
  }
}

export function startFeeder() {
  recoverOnBoot();
  setInterval(tick, config.cups.pollMs);
}
