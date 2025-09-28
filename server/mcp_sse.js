// server/mcp_sse.js
import express from "express";
export const mcpRouter = express.Router();

mcpRouter.get("/sse", (req, res) => {
  // Required headers for ChatGPT custom connector
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // CORS: allow ChatGPT origins
  res.setHeader("Access-Control-Allow-Origin", "https://chat.openai.com");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "*");

  // Immediately tell ChatGPT we're ready and what tools exist
  const ready = {
    type: "ready",
    tools: [
      { name: "list_files", args: { path: "string" } },
      { name: "read_file", args: { path: "string" } },
      { name: "write_file", args: { path: "string", content: "string" } },
    ],
    meta: { project: "ChangoAI", env: "replit" }
  };
  res.write(`data: ${JSON.stringify(ready)}\n\n`);

  // Heartbeat so the connection stays open
  const interval = setInterval(() => res.write(`: ping\n\n`), 15000);

  req.on("close", () => clearInterval(interval));
});

// Optional JSON diag (good for testing in a browser)
mcpRouter.get("/diag", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://chat.openai.com");
  res.json({ ok: true, service: "Chango_MCP", time: Date.now() });
});