import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getAdminPasswordHash, setAdminPasswordHash, getJwtSecret } from "./auth.model.js";

export function login(req, res) {
  const { password } = req.body || {};
  if (!password || !bcrypt.compareSync(password, getAdminPasswordHash())) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ role: "admin" }, getJwtSecret(), {
    expiresIn: config.auth.tokenLifetime,
  });
  res.json({ token });
}

export function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }
  if (!bcrypt.compareSync(currentPassword || "", getAdminPasswordHash())) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  setAdminPasswordHash(bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
}
