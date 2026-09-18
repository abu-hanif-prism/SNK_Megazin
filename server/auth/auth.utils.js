import jwt from "jsonwebtoken";
import { getJwtSecret } from "./auth.model.js";

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret()); // throws if invalid
}

// For endpoints the admin console also calls through the guest flow (e.g.
// test-printing from the same device): true only for a valid admin bearer
// token, never throws — absence/invalidity just means "not an admin".
export function isAdminRequest(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return false;
  try {
    verifyToken(header.slice(7));
    return true;
  } catch {
    return false;
  }
}
