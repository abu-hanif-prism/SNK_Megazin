// Response shaping, print-upload multer config, and small pure helpers.
import multer from "multer";
import path from "node:path";
import { config } from "../config.js";
import { queuePositionOf } from "./prints.model.js";

export const printUpload = multer({
  dest: path.join(config.printsDir, ".tmp"),
  limits: { fileSize: config.uploadLimitBytes },
});

export function printJson(p, { withPosition = false } = {}) {
  const json = {
    id: p.id,
    sessionId: p.session_id,
    clientId: p.client_id,
    url: `/prints/${p.session_id}/${p.file_name}`,
    layout: p.layout,
    effect: p.effect,
    copies: p.copies,
    rating: p.rating,
    status: p.status,
    error: p.error,
    createdAt: p.created_at,
    printedAt: p.printed_at,
  };
  if (withPosition) json.queuePosition = queuePositionOf(p.id);
  return json;
}

export function printFilePath(print) {
  return path.join(config.printsDir, String(print.session_id), print.file_name);
}

/** The uploaded file IS the final print (composed client-side at the target
 * print size) — validate it matches an A4 sheet within tolerance. */
export function validatePrintDimensions(dim) {
  const target = dim.width >= dim.height ? config.printSize.horizontal : config.printSize.vertical;
  const scale = dim.width / target.width;
  const ratioOk = Math.abs(dim.width / dim.height - target.width / target.height) < 0.02;
  if (!ratioOk || scale < config.minPrintScale) {
    return {
      ok: false,
      message: `Image must be A4 ratio at ≥${Math.round(target.width * config.minPrintScale)}px wide (got ${dim.width}x${dim.height})`,
    };
  }
  return { ok: true };
}
