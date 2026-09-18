// Express middleware: gates admin-only routes behind a valid JWT bearer token.
import { verifyToken } from "../auth/auth.utils.js";

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Auth token missing" });
  }
  try {
    req.admin = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: "Invalid auth token" });
  }
}
