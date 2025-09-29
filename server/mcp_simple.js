// Simplified MCP SSE endpoint for ChatGPT testing
import express from "express";

export function registerSimpleMcp(app) {
  const router = express.Router();
  
  // Simple discovery endpoint
  router.get("/", (req, res) => {
    res.json({
      name: "ChangoAI MCP",
      version: "1.0.0",
      description: "MCP connector for ChangoAI",
      sse_endpoint: "/simple-mcp/sse"
    });
  });
  
  // SSE endpoint
  router.get("/sse", (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });
    
    // Send simple ready event
    const data = JSON.stringify({
      type: "ready",
      tools: [
        { name: "search", description: "Search for information" },
        { name: "fetch", description: "Fetch data by ID" }
      ]
    });
    res.write(`data: ${data}\n\n`);
    
    // Keep connection alive
    const interval = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 15000);
    
    req.on('close', () => {
      clearInterval(interval);
    });
  });
  
  // OPTIONS for CORS
  router.options("/sse", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
  });
  
  app.use("/simple-mcp", router);
}