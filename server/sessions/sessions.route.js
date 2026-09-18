import express from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { frameUpload } from "./sessions.utils.js";
import {
  getPublicSession,
  listAllSessions,
  createSession,
  updateSession,
  deleteSession,
  activateSession,
  uploadFrame,
  deleteFrame,
  addBan,
  removeBan,
} from "./sessions.controller.js";

// --- public: guest boot -------------------------------------------------------
export const publicSessionRouter = express.Router();
publicSessionRouter.get("/", getPublicSession);

// --- admin: session CRUD + frames + bans --------------------------------------
export const adminSessionRouter = express.Router();
adminSessionRouter.use(requireAdmin);

adminSessionRouter.get("/", listAllSessions);
adminSessionRouter.post("/", createSession);
adminSessionRouter.put("/:id", updateSession);
adminSessionRouter.delete("/:id", deleteSession);
adminSessionRouter.post("/:id/activate", activateSession);

adminSessionRouter.post(
  "/:id/frames",
  frameUpload.fields([{ name: "file", maxCount: 1 }, { name: "preview", maxCount: 1 }]),
  uploadFrame
);
adminSessionRouter.delete("/:id/frames/:frameId", deleteFrame);

adminSessionRouter.post("/:id/bans", addBan);
adminSessionRouter.delete("/:id/bans/:name", removeBan);
