// Socket.io: admins join an authenticated "admin" room and receive queue
// updates when something actually changes (no more 2.5s broadcast to every
// guest). Guests don't use sockets — they poll their own print's status.
import { Server } from "socket.io";
import { db, activeSessionId } from "./db.js";
import { verifyToken } from "./auth/auth.utils.js";

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: "*" } });

  io.use((socket, next) => {
    try {
      verifyToken(socket.handshake.auth?.token || "");
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join("admin");
    socket.emit("queue:update", queueSnapshot());
  });

  return io;
}

function queueSnapshot() {
  const sessionId = activeSessionId();
  if (!sessionId) return { sessionId: null, prints: [] };
  const prints = db
    .prepare(
      `SELECT id, client_id, file_name, session_id, status, copies, rating,
              queue_position, error, created_at, printed_at
       FROM prints WHERE session_id = ? ORDER BY created_at ASC, id ASC`
    )
    .all(sessionId)
    .map((p) => ({
      id: p.id,
      clientId: p.client_id,
      url: `/prints/${p.session_id}/${p.file_name}`,
      status: p.status,
      copies: p.copies,
      rating: p.rating,
      queuePosition: p.queue_position,
      error: p.error,
      createdAt: p.created_at,
      printedAt: p.printed_at,
    }));
  return { sessionId, prints };
}

let pending = null;

/** Debounced push of the queue state to the admin room. */
export function emitQueueUpdate() {
  if (!io || pending) return;
  pending = setTimeout(() => {
    pending = null;
    io.to("admin").emit("queue:update", queueSnapshot());
  }, 150);
}
