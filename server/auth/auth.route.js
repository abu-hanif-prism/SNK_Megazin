// Admin auth: single admin user (see auth.model.js for where the credentials
// live). JWT secret is generated per-device on first boot — nothing secret
// lives in the repo.
import express from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { login, changePassword } from "./auth.controller.js";

export const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.post("/password", requireAdmin, changePassword);
