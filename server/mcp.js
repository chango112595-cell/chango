// server/mcp.js
import fs from "fs";
import path from "path";
import os from "os";
import url from "url";
import { WebSocketServer } from "ws";

export function registerMCP(app, server) {
  // ---- CONFIG
  const TOKEN = process.env.MCP_TOKEN || "mcp-connect-chatgpt";
  const PROJECT_ROOT = process.cwd();
  const WRITE_ROOT = path.join(PROJECT_ROOT, "data", "mcp");
  fs.mkdirSync(WRITE_ROOT, { recursive: true });

  // ---- AUTH
  function requireToken(req, res, next) {
    const token = (req.query.token || req.headers["x-mcp-token"] || "").toString();
    if (token !== TOKEN) return res.status(401).json({ ok: false, error: "invalid_token" });
    next();
  }

  // ---- COMMON DIAGNOSTICS
  function collectDiag() {
    const mem = process.memoryUsage();
    const cpu = os.loadavg?.() || [];
    return {
      ok: true,
      now: new Date().toISOString(),
      node: process.version,
      pid: process.pid,
      platform: process.platform,
      uptime_sec: Math.round(process.uptime()),
      memory: {
        rss_mb: +(mem.rss / 1024 / 1024).toFixed(1),
        heapUsed_mb: +(mem.heapUsed / 1024 / 1024).toFixed(1),
      },
      cpu_load_1m: cpu[0] || null,
      env: {
        PORT: process.env.PORT,
        MCP_TOKEN_SET: !!process.env.MCP_TOKEN,
        NODE_ENV: process.env.NODE_ENV || "dev",
      },
      paths: { PROJECT_ROOT, WRITE_ROOT },
    };
  }

  // ---- HEALTH & DIAG
  app.get("/mcp/health", (req, res) => res.json({ ok: true, now: new Date().toISOString() }));
  app.get("/mcp/diag", requireToken, (req, res) => res.json(collectDiag()));

  // ---- TOOLS
  // list_files: list project tree (read-only)
  app.get("/mcp/tools/list_files", requireToken, (req, res) => {
    const { base = ".", globs = "" } = req.query;
    const root = path.resolve(PROJECT_ROOT, base.toString());
    if (!root.startsWith(PROJECT_ROOT)) return res.status(400).json({ ok: false, error: "path_outside_project" });

    function walk(d) {
      const out = [];
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const rel = path.relative(PROJECT_ROOT, full);
        const stat = fs.statSync(full);
        out.push({ path: rel, dir: stat.isDirectory(), size: stat.size });
        if (stat.isDirectory()) out.push(...walk(full));
      }
      return out;
    }
    const all = walk(root);
    const filters = globs ? globs.toString().split(",").map(s=>s.trim()).filter(Boolean) : [];
    const filtered = !filters.length ? all :
      all.filter(x => filters.some(g => x.path.includes(g.replace("*",""))));
    res.json({ ok: true, files: filtered });
  });

  // read_file: read any file in project (read-only)
  app.get("/mcp/tools/read_file", requireToken, (req, res) => {
    const p = req.query.path?.toString();
    if (!p) return res.status(400).json({ ok: false, error: "missing_path" });
    const abs = path.resolve(PROJECT_ROOT, p);
    if (!abs.startsWith(PROJECT_ROOT)) return res.status(400).json({ ok: false, error: "path_outside_project" });
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return res.status(404).json({ ok: false, error: "not_found" });
    const content = fs.readFileSync(abs, "utf8");
    res.json({ ok: true, path: p, content });
  });

  // write_file: write ONLY inside data/mcp/
  app.post("/mcp/tools/write_file", requireToken, expressJson(app), (req, res) => {
    const { path: rel, content } = req.body || {};
    if (!rel || typeof content !== "string") return res.status(400).json({ ok: false, error: "bad_body" });
    const abs = path.resolve(WRITE_ROOT, rel);
    if (!abs.startsWith(WRITE_ROOT)) return res.status(400).json({ ok: false, error: "write_outside_sandbox" });
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    res.json({ ok: true, path: path.relative(PROJECT_ROOT, abs) });
  });

  // ---- SSE endpoint (preferred for ChatGPT)
  app.get("/mcp/sse", requireToken, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const hello = { type: "ready", diag: collectDiag(), tools: ["list_files","read_file","write_file"] };
    res.write(`data: ${JSON.stringify(hello)}\n\n`);
    req.on("close", () => { /* client disconnected */ });
  });

  // ---- WebSocket endpoint (optional)
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const { searchParams } = new url.URL(request.url, "http://localhost");
    if (!request.url.startsWith("/mcp")) return;
    const t = searchParams.get("token");
    if (t !== TOKEN) return socket.destroy();
    wss.handleUpgrade(request, socket, head, ws => {
      ws.send(JSON.stringify({ type: "ready", diag: collectDiag(), tools: ["list_files","read_file","write_file"] }));
      ws.on("message", (msg) => {
        // echo back minimal protocol
        ws.send(JSON.stringify({ type: "ack", received: String(msg).slice(0, 500) }));
      });
    });
  });
}

// small helper to avoid adding body-parser globally
function expressJson(app) {
  const exp = app; // express instance passed in
  return (req, res, next) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { req.body = data ? JSON.parse(data) : {}; } catch { req.body = {}; }
      next();
    });
  };
}