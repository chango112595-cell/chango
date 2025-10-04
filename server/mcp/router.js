import express from "express";
export const mcpRouter = express.Router();

function getToken(req){
  const h = req.headers["authorization"];
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.query.token;
}
function auth(req, res){ 
  if (getToken(req) !== process.env.MCP_TOKEN) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

// discovery
mcpRouter.get("/", (req, res) => {
  if (!auth(req, res)) return;
  res.json({
    tools: [
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file",
      },
    ],
  });
});

// invoke
mcpRouter.post("/write_file", express.json({ limit: "1mb" }), (req, res) => {
  if (!auth(req, res)) return;
  const { path, content } = req.body || {};
  if (!path || typeof content !== "string") return res.status(400).json({ error: "invalid_args" });
  console.log("[write]", path, content.length, "bytes");
  // TODO: actually write the file if your environment permits
  res.json({ ok: true });
});