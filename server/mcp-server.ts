import express from "express";
import { mcpRouter } from "./mcp/router";
// @ts-ignore
import { registerSimpleMcp } from "./mcp_simple.js";

const mcpApp = express();
const MCP_PORT = 41485; // Internal port that maps to external 8080

// MCP endpoints
mcpApp.use("/mcp", mcpRouter);
registerSimpleMcp(mcpApp);

// Root endpoint for discovery
mcpApp.get("/", (req, res) => {
  res.json({
    name: "ChangoAI MCP Server",
    version: "1.0.0",
    port: MCP_PORT,
    endpoints: {
      main: "/mcp/sse",
      simple: "/simple-mcp/sse",
      websocket: "/mcp/ws"
    }
  });
});

// Start MCP server on port 8080
mcpApp.listen(MCP_PORT, "0.0.0.0", () => {
  console.log(`[MCP Server] Running on port ${MCP_PORT}`);
  console.log(`[MCP Server] SSE endpoints:`);
  console.log(`  - http://0.0.0.0:${MCP_PORT}/mcp/sse`);
  console.log(`  - http://0.0.0.0:${MCP_PORT}/simple-mcp/sse`);
});

export default mcpApp;