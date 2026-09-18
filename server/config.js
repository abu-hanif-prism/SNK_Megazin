// Central configuration. Environment variables override defaults.
// On the devices this is set once in /home/snapnkeep/servers/server/.env
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  root,
  port: Number(process.env.PORT || 8080),
  dbFile: path.join(root, process.env.DB_FILE || "snapnkeep.sqlite3"),

  // File storage (all under public/, served statically). PUBLIC_DIR override
  // exists for tests so they never touch real frame/print storage.
  publicDir: process.env.PUBLIC_DIR || path.join(root, "public"),
  framesDir: path.join(process.env.PUBLIC_DIR || path.join(root, "public"), "frames"),
  printsDir: path.join(process.env.PUBLIC_DIR || path.join(root, "public"), "prints"),

  // Print output contract: A4 at 300 DPI, composed client-side.
  printSize: {
    vertical: { width: 2480, height: 3508 },
    horizontal: { width: 3508, height: 2480 },
  },
  // Accept client renders within this tolerance (older phones may cap canvas
  // size slightly below target); anything smaller is rejected.
  minPrintScale: 0.66,

  // CUPS queue feeder
  cups: {
    // Max jobs handed to the CUPS spooler at once. Small on purpose: the DB is
    // the real queue; CUPS is just a buffer so the printer never idles.
    maxInFlight: Number(process.env.CUPS_MAX_IN_FLIGHT || 2),
    pollMs: Number(process.env.CUPS_POLL_MS || 2000),
    printerName: process.env.PRINTER_NAME || "", // empty = system default
    // Dev machines (mac/win) have no G1020: pretend jobs complete after a delay.
    mock: process.env.MOCK_CUPS === "true",
    mockPrintSeconds: Number(process.env.MOCK_PRINT_SECONDS || 5),
  },

  auth: {
    // Used only to seed the admin password on first boot; change it from the
    // console afterwards (stored bcrypt-hashed in the settings table).
    initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD || "snapnkeep",
    tokenLifetime: process.env.JWT_LIFETIME || "30d",
  },

  uploadLimitBytes: Number(process.env.UPLOAD_LIMIT_MB || 25) * 1024 * 1024,
};
