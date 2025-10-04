import express from "express";
import { mcpRouter } from "./mcp/router.js";

const app = express();

// quick health
app.get("/healthz", (req, res) => res.status(200).send("ok"));

// (optional) minimal req logging during debug
app.use((req, _res, next) => {
  console.log(`[req] ${new Date().toISOString()} ${req.method} ${req.path} qs=${JSON.stringify(req.query)}`);
  next();
});

// mount MCP under /mcp
app.use("/mcp", mcpRouter);

// bind as Replit expects
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => console.log("listening", PORT));