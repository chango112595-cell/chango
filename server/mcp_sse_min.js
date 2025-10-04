// Minimal SSE endpoint for ChatGPT connector compatibility
import express from "express";
export const mcpSseMin = express.Router();

mcpSseMin.get("/sse", (req, res) => {
  // CORS for ChatGPT web + desktop
  const ALLOW = ["https://chat.openai.com", "app://chat.openai.com"];
  const origin = req.headers.origin;
  if (origin && ALLOW.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://chat.openai.com");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "*");

  // SSE essentials
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.(); // in case compression is on

  // REQUIRED: ready event immediately
  res.write(`data: ${JSON.stringify({
    type: "ready",
    tools: [
      { name: "list_files", args: { path: "string" } },
      { name: "read_file",  args: { path: "string" } },
      { name: "write_file", args: { path: "string", content: "string" } },
    ],
    meta: { project: "ChangoAI" }
  })}\n\n`);

  // Heartbeat (keeps the connection alive)
  const hb = setInterval(() => res.write(`: ping\n\n`), 15000);
  req.on("close", () => clearInterval(hb));
});

// Optional preflight (some clients send it)
mcpSseMin.options("/sse", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://chat.openai.com");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.status(204).end();
});