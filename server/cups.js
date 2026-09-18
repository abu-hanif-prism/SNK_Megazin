// CUPS wrappers. These shell commands target the Ubuntu devices (Canon G1020)
// and must stay Linux-shaped — do NOT adapt them to mac/windows; dev machines
// run with MOCK_CUPS=true instead.
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";

const execAsync = promisify(exec);

// --- mock mode (dev machines without the printer) ----------------------------
const mockJobs = new Map(); // jobId -> completion timestamp
let mockSeq = 100;

async function run(cmd) {
  console.log("CUPS cmd:", cmd);
  const { stdout } = await execAsync(cmd);
  console.log("CUPS out:", stdout.trim());
  return stdout;
}

/** Submit a file to CUPS. Returns the numeric job id as a string, or null. */
export async function submitJob(filePath) {
  if (config.cups.mock) {
    const id = String(++mockSeq);
    mockJobs.set(id, Date.now() + config.cups.mockPrintSeconds * 1000);
    return id;
  }
  const dest = config.cups.printerName ? `-d ${config.cups.printerName} ` : "";
  const out = await run(`lp ${dest}"${filePath}"`);
  // e.g. "request id is G1020USB-123 (1 file(s))"
  const match = out.match(/(\d+)\s*\(1 file/);
  return match ? match[1] : null;
}

/** Numeric ids of jobs currently in the CUPS queue (pending or printing). */
export async function runningJobIds() {
  if (config.cups.mock) {
    const now = Date.now();
    for (const [id, doneAt] of mockJobs) if (doneAt <= now) mockJobs.delete(id);
    return [...mockJobs.keys()];
  }
  const out = await run("lpstat -o");
  const ids = [];
  for (const line of out.split("\n")) {
    const token = line.trim().split(/\s+/)[0]; // e.g. "G1020USB-123"
    const id = token?.slice(token.lastIndexOf("-") + 1);
    if (id && /^\d+$/.test(id)) ids.push(id);
  }
  return ids;
}

/** Cancel a CUPS job (no-op if it already left the queue). */
export async function cancelJob(jobId) {
  if (config.cups.mock) {
    mockJobs.delete(String(jobId));
    return;
  }
  try {
    await run(`cancel ${jobId}`);
  } catch {
    // job already finished/left the queue — nothing to cancel
  }
}

/** Printer health: 'ready' | 'stopped' | 'unknown'. */
export async function printerState() {
  if (config.cups.mock) return "ready";
  try {
    const out = await run("lpstat -p");
    if (/is idle|printing/i.test(out)) return "ready";
    if (/disabled|stopped/i.test(out)) return "stopped";
    return "unknown";
  } catch {
    return "unknown";
  }
}
