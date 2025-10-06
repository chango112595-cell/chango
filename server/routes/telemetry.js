import express from "express";
import { setHUD, getHUD } from "../state/hud.js";
const router = express.Router();

router.post("/api/telemetry", express.json({ limit: "256kb" }), (req, res) => {
  try { 
    setHUD(req.body || {}); 
  } catch {}
  res.json({ ok: true });
});

router.get("/hud/status.json", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getHUD());
});

export default router;