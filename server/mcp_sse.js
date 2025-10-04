// server/mcp_sse.js
import express from "express";

export function registerMcp(app) {
  const router = express.Router();

  // ---- CORS helper (web + desktop app) ----
  const ALLOW = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  function cors(res, origin) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin && ALLOW.has(origin) ? origin : "https://chat.openai.com"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "*");
  }

  // ---- Diagnostics (quick JSON check) ----
  router.get("/diag", (req, res) => {
    cors(res, req.headers.origin);
    res.json({
      ok: true,
      note: "Use /mcp/sse for the ChatGPT connector.",
      time: new Date().toISOString(),
      headers: {
        host: req.headers.host,
        origin: req.headers.origin || null,
      },
      expects: {
        contentType: "text/event-stream",
        firstEvent: { type: "ready" },
        noRedirects: true,
        noQueryParams: true,
      }
    });
  });

  // ---- SSE endpoint for ChatGPT custom connector ----
  router.get("/sse", (req, res) => {
    cors(res, req.headers.origin);

    // IMPORTANT: exact headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // REQUIRED first event
    const ready = {
      type: "ready",
      tools: [
        // Deep research tools (required for ChatGPT deep research)
        { name: "search",      args: { query: "string" } },
        { name: "fetch",       args: { id: "string" } },
        // File management tools
        { name: "list_files",  args: { path: "string" } },
        { name: "read_file",   args: { path: "string" } },
        { name: "write_file",  args: { path: "string", content: "string" } },
      ],
      meta: { project: "ChangoAI" }
    };
    res.write(`data: ${JSON.stringify(ready)}\n\n`);

    // Heartbeat to keep connection alive
    const hb = setInterval(() => res.write(`: ping\n\n`), 15000);
    req.on("close", () => clearInterval(hb));
  });

  // Preflight (some clients send OPTIONS)
  router.options("/sse", (req, res) => {
    cors(res, req.headers.origin);
    res.status(204).end();
  });

  // ---- Simple in-browser tester (open in your browser) ----
  router.get("/sse-test", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html>
<html><body style="font-family:system-ui;margin:20px">
<h3>MCP SSE smoke test</h3>
<pre id="log"></pre>
<script>
  const log = (m)=>{document.getElementById('log').textContent += m + "\\n"};
  const es = new EventSource(location.origin + "/mcp/sse");
  es.onmessage = (e)=>log("message: " + e.data);
  es.onerror   = (e)=>log("error (check CORS/headers)");
</script>
</body></html>`);
  });

  app.use("/mcp", router);
}