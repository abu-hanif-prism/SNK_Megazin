// Admin auth settings: JWT secret + bcrypt-hashed password, both stored in the
// generic settings table (seeded on first boot in db.js).
import { getSetting, setSetting } from "../db.js";

export function getAdminPasswordHash() {
  return getSetting("admin_password_hash");
}

export function setAdminPasswordHash(hash) {
  setSetting("admin_password_hash", hash);
}

export function getJwtSecret() {
  return getSetting("jwt_secret");
}
