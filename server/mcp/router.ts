import express, { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// Types for MCP endpoints
interface MCPTool {
  name: string;
  path: string;
  description: string;
}

interface MCPDiscoveryResponse {
  tools: MCPTool[];
}

interface WriteFileRequest {
  path: string;
  content: string;
}

interface WriteFileResponse {
  ok: boolean;
  error?: string;
  written?: number;
}

// Create router instance
export const mcpRouter: Router = express.Router();

// Authentication function that supports both Bearer token and query parameter
function getToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.query.token as string | undefined;
}

function authenticate(req: Request, res: Response): boolean {
  const token = getToken(req);
  const expectedToken = process.env.MCP_TOKEN || "mcp-connect-chatgpt";
  
  if (token !== expectedToken) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  
  return true;
}

// GET /mcp - Discovery endpoint
mcpRouter.get("/", (req: Request, res: Response<MCPDiscoveryResponse | { error: string }>) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] Discovery endpoint called`);
  
  const response: MCPDiscoveryResponse = {
    tools: [
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file"
      }
    ]
  };
  
  res.json(response);
});

// POST /mcp/write_file - Write file endpoint
mcpRouter.post("/write_file", express.json({ limit: "1mb" }), async (req: Request<{}, {}, WriteFileRequest>, res: Response<WriteFileResponse | { error: string }>) => {
  if (!authenticate(req, res)) return;
  
  const { path: filePath, content } = req.body || {};
  
  // Validate request parameters
  if (!filePath || typeof content !== "string") {
    return res.status(400).json({ error: "invalid_args: path and content are required" });
  }
  
  console.log(`[MCP] Write file request: ${filePath} (${content.length} bytes)`);
  
  try {
    // Create safe directory path - restrict writes to ./data/mcp/
    const safeBasePath = path.resolve(process.cwd(), "data", "mcp");
    
    // Normalize and resolve the requested path
    const requestedFileName = path.basename(filePath);
    const fullPath = path.join(safeBasePath, requestedFileName);
    
    // Security check: ensure the resolved path is within the safe directory
    if (!fullPath.startsWith(safeBasePath)) {
      console.error(`[MCP] Security violation: attempted to write outside safe directory: ${filePath}`);
      return res.status(400).json({ error: "invalid_args: path traversal detected" });
    }
    
    // Ensure the directory exists
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    
    // Write the file
    await fs.promises.writeFile(fullPath, content, "utf-8");
    
    console.log(`[MCP] Successfully wrote file: ${fullPath}`);
    
    const response: WriteFileResponse = {
      ok: true,
      written: content.length
    };
    
    res.json(response);
  } catch (error) {
    console.error(`[MCP] Error writing file:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const response: WriteFileResponse = {
      ok: false,
      error: `Failed to write file: ${errorMessage}`
    };
    
    res.status(500).json(response);
  }
});

// Health check endpoint for the MCP router
mcpRouter.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "mcp" });
});