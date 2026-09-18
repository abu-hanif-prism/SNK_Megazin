// Snapnkeep Mini backend v2 — single process: REST + socket.io + static files
// + the CUPS queue feeder. Plain Node.js, no build step.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import http from "node:http";
import { config } from "./config.js";
import { authRouter } from "./auth/auth.route.js";
import { publicSessionRouter, adminSessionRouter } from "./sessions/sessions.route.js";
import { publicPrintRouter, adminPrintRouter } from "./prints/prints.route.js";
import { initRealtime } from "./realtime.js";
import { startFeeder } from "./prints/prints.controller.js";
import * as cups from "./cups.js";

const app = express();
const server = http.createServer(app);
initRealtime(server);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(morgan("dev")); // request log: METHOD /url status time
app.use(express.json({ limit: "1mb" }));

// static: frames + finished prints (nginx takes this over in production if
// configured; node serving them also works)
app.use(
  express.static(config.publicDir, {
    maxAge: "365d",
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".json")) res.setHeader("Cache-Control", "no-store");
    },
  })
);

// public (guest)
app.use("/api/v2/session", publicSessionRouter);
app.use("/api/v2/prints", publicPrintRouter);

// admin
app.use("/api/v2/auth", authRouter);
app.use("/api/v2/admin/sessions", adminSessionRouter);
app.use("/api/v2/admin/prints", adminPrintRouter);

app.get("/api/v2/health", async (req, res) => {
  res.json({ ok: true, printer: await cups.printerState(), mock: config.cups.mock });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// central error handler (multer errors, unexpected throws) — full stack trace
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(err instanceof Error ? err.stack : err);
  const status = err.name === "MulterError" ? 400 : 500;
  res.status(status).json({ error: err.message || "Something went wrong" });
});

startFeeder();
server.listen(config.port, () => {
  console.log(
    `Snapnkeep server v2 on :${config.port} (CUPS ${config.cups.mock ? "MOCK" : "real"}, buffer ${config.cups.maxInFlight})`
  );
});
