import express from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { printUpload } from "./prints.utils.js";
import {
  submitPrint,
  getPrint,
  ratePrint,
  listForSession,
  reorderQueue,
  cancelPrintHandler,
  reprintHandler,
  resolveHandler,
  deletePrintHandler,
  getStats,
} from "./prints.controller.js";

// --- public (guest) ------------------------------------------------------------
export const publicPrintRouter = express.Router();

publicPrintRouter.post("/", printUpload.single("image"), submitPrint);
publicPrintRouter.get("/:id", getPrint);
publicPrintRouter.put("/:id/rating", ratePrint);

// --- admin -----------------------------------------------------------------
export const adminPrintRouter = express.Router();
adminPrintRouter.use(requireAdmin);

adminPrintRouter.get("/session/:sessionId", listForSession);
adminPrintRouter.post("/queue/reorder", reorderQueue);
adminPrintRouter.post("/:id/cancel", cancelPrintHandler);
adminPrintRouter.post("/:id/reprint", reprintHandler);
adminPrintRouter.post("/:id/resolve", resolveHandler);
adminPrintRouter.delete("/:id", deletePrintHandler);
adminPrintRouter.get("/session/:sessionId/stats", getStats);
