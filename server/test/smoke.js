// End-to-end smoke test against a throwaway DB with MOCK_CUPS.
// Run: npm run smoke   (starts its own server on a test port)
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const PORT = 8099;
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_DB = "smoke-test.sqlite3";

// throwaway state
const TEST_PUBLIC = path.join(root, "smoke-test-public");
fs.rmSync(TEST_PUBLIC, { recursive: true, force: true });
for (const f of [TEST_DB, `${TEST_DB}-shm`, `${TEST_DB}-wal`]) {
  fs.rmSync(path.join(root, f), { force: true });
}

const srv = spawn(process.execPath, ["server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    PUBLIC_DIR: TEST_PUBLIC,
    DB_FILE: TEST_DB,
    MOCK_CUPS: "true",
    MOCK_PRINT_SECONDS: "2",
    CUPS_POLL_MS: "300",
    CUPS_MAX_IN_FLIGHT: "2",
    INITIAL_ADMIN_PASSWORD: "smoketest-pass",
  },
  stdio: ["ignore", "pipe", "inherit"],
});
srv.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, url, { body, token, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + url, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// Minimal valid PNG at arbitrary size (1x1 pixels scaled via IHDR is invalid;
// generate real dimensions with a tiny uncompressed-ish approach is overkill —
// use a JPEG built by canvas? Not available. Instead: craft PNG via zlib.)
import zlib from "node:zlib";
function makePng(width, height) {
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
  const raw = Buffer.alloc((width + 1) * height); // filter byte 0 + zero pixels
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function printForm(name, { w = 2480, h = 3508 } = {}) {
  const form = new FormData();
  form.append("image", new Blob([makePng(w, h)], { type: "image/png" }), "print.png");
  form.append("clientId", name);
  form.append("layout", "vertical");
  form.append("effect", "normal");
  return form;
}

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok: ${label}`);
  else { failures++; console.error(`  FAIL: ${label}`); }
}

try {
  // wait for boot
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/api/v2/health`)).ok) break; } catch {}
    await sleep(200);
  }

  console.log("auth");
  check("bad login rejected", (await req("POST", "/api/v2/auth/login", { body: { password: "nope" } })).status === 401);
  const { json: login } = await req("POST", "/api/v2/auth/login", { body: { password: "smoketest-pass" } });
  const token = login?.token;
  check("login returns token", !!token);
  check("short password rejected", (await req("POST", "/api/v2/auth/password", { token, body: { currentPassword: "smoketest-pass", newPassword: "short" } })).status === 400);
  check("admin route rejects no token", (await req("GET", "/api/v2/admin/sessions")).status === 401);

  console.log("sessions");
  check("no active session yet", (await req("GET", "/api/v2/session")).status === 404);
  const { status: cs, json: session } = await req("POST", "/api/v2/admin/sessions", {
    token,
    body: { clientName: "Smoke Event", userMaxPrintCount: 2, sessionPrintThreshold: 5 },
  });
  check("create session", cs === 201 && session.id > 0);

  // frame upload (full + preview)
  const frameForm = new FormData();
  frameForm.append("file", new Blob([makePng(2480, 3508)], { type: "image/png" }), "frame.png");
  frameForm.append("preview", new Blob([makePng(240, 340)], { type: "image/webp" }), "frame.webp");
  frameForm.append("orientation", "vertical");
  const { status: fs2, json: frame } = await req("POST", `/api/v2/admin/sessions/${session.id}/frames`, { token, form: frameForm });
  check("frame upload", fs2 === 201 && frame.url.endsWith(".png") && frame.previewUrl.includes("preview"));

  check("activate", (await req("POST", `/api/v2/admin/sessions/${session.id}/activate`, { token })).status === 200);
  const { json: pub } = await req("GET", "/api/v2/session");
  check("guest boot payload", pub.clientName === "Smoke Event" && pub.frames.vertical.length === 1 && pub.queueLength === 0);

  console.log("guest submission gates");
  check("name too short", (await req("POST", "/api/v2/prints", { form: printForm("ab") })).status === 400);
  check("bad dimensions", (await req("POST", "/api/v2/prints", { form: printForm("carol", { w: 500, h: 900 }) })).status === 400);

  const { status: p1s, json: p1 } = await req("POST", "/api/v2/prints", { form: printForm("alice") });
  check("print accepted", p1s === 201 && p1.status === "queued" && p1.queuePosition >= 1);
  const { json: p2 } = await req("POST", "/api/v2/prints", { form: printForm("alice") });
  check("second print accepted", p2?.id > p1.id);
  check("per-user limit enforced", (await req("POST", "/api/v2/prints", { form: printForm("alice") })).json?.code === "USER_LIMIT");

  await req("POST", `/api/v2/admin/sessions/${session.id}/bans`, { token, body: { name: "mallory" } });
  check("banned name rejected", (await req("POST", "/api/v2/prints", { form: printForm("mallory") })).json?.code === "BANNED");

  await req("PUT", `/api/v2/admin/sessions/${session.id}`, { token, body: { breakMode: true } });
  check("break mode blocks", (await req("POST", "/api/v2/prints", { form: printForm("bob") })).json?.code === "BREAK_MODE");
  await req("PUT", `/api/v2/admin/sessions/${session.id}`, { token, body: { breakMode: false } });

  console.log("queue lifecycle (mock printer: 2s/print, buffer 2)");
  const { json: p3 } = await req("POST", "/api/v2/prints", { form: printForm("bob") });
  const { json: p4 } = await req("POST", "/api/v2/prints", { form: printForm("dave") });
  await sleep(700); // feeder tick
  let st = (await req("GET", `/api/v2/prints/${p1.id}`)).json;
  check("first print submitted to CUPS", ["submitted", "completed"].includes(st.status));
  st = (await req("GET", `/api/v2/prints/${p4.id}`)).json;
  check("4th print still queued (buffer=2)", st.status === "queued" && st.queuePosition >= 1);

  // reorder: dave jumps ahead of bob
  const { json: qs } = await req("GET", `/api/v2/admin/prints/session/${session.id}`, { token });
  const queuedIds = qs.prints.filter((p) => p.status === "queued").map((p) => p.id);
  await req("POST", "/api/v2/admin/prints/queue/reorder", { token, body: { orderedIds: [...queuedIds].reverse() } });
  const after = (await req("GET", `/api/v2/prints/${p4.id}`)).json;
  check("reorder moved print up", after.queuePosition === 1);

  // rating
  check("rating saved", (await req("PUT", `/api/v2/prints/${p1.id}/rating`, { body: { rating: 5 } })).status === 200);
  check("rating bounds", (await req("PUT", `/api/v2/prints/${p1.id}/rating`, { body: { rating: 9 } })).status === 400);

  // session threshold (5): alice 2 + bob 1 + dave 1 = 4, one more allowed, then blocked
  await req("POST", "/api/v2/prints", { form: printForm("erin") });
  check("session threshold enforced", (await req("POST", "/api/v2/prints", { form: printForm("frank") })).json?.code === "SESSION_LIMIT");

  console.log("drain + completion");
  for (let i = 0; i < 40; i++) {
    const all = (await req("GET", `/api/v2/admin/prints/session/${session.id}`, { token })).json.prints;
    if (all.every((p) => p.status === "completed")) break;
    await sleep(500);
  }
  const all = (await req("GET", `/api/v2/admin/prints/session/${session.id}`, { token })).json.prints;
  check("all prints completed via feeder", all.length === 5 && all.every((p) => p.status === "completed"));

  const { json: stats } = await req("GET", `/api/v2/admin/prints/session/${session.id}/stats`, { token });
  check("stats aggregate", stats.byClient.find((c) => c.name === "alice")?.prints === 2);

  console.log("reprint + needs_attention triage");
  await req("POST", `/api/v2/admin/prints/${p1.id}/reprint`, { token });
  let rp = (await req("GET", `/api/v2/prints/${p1.id}`)).json;
  check("reprint re-queued with copies+1", rp.copies === 2 && ["queued", "submitted"].includes(rp.status));
  // simulate crash recovery: flip to submitted state is transient; wait then check resolve API guard
  check("resolve guard on non-attention print", (await req("POST", `/api/v2/admin/prints/${p3.id}/resolve`, { token, body: { action: "done" } })).status === 409);

  console.log(failures === 0 ? "\nSMOKE PASSED" : `\n${failures} FAILURES`);
} finally {
  srv.kill();
  fs.rmSync(TEST_PUBLIC, { recursive: true, force: true });
  for (const f of [TEST_DB, `${TEST_DB}-shm`, `${TEST_DB}-wal`]) {
    fs.rmSync(path.join(root, f), { force: true });
  }
}
process.exit(failures === 0 ? 0 : 1);
