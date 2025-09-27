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

interface SearchRequest {
  query: string;
}

interface SearchResponse {
  results: string[];
}

interface FetchRequest {
  id: string;
}

interface FetchResponse {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
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
        name: "search",
        path: "/mcp/search",
        description: "Search for files and content in the MCP storage. Takes a query string and returns matching file IDs."
      },
      {
        name: "fetch",
        path: "/mcp/fetch",
        description: "Fetch the complete content of a file by its ID. Returns the full file data for analysis."
      },
      {
        name: "mcp_token_write_file",
        path: "/mcp/write_file",
        description: "Create or overwrite a UTF-8 text file in the MCP storage"
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

// POST /mcp/search - Search for files and content
mcpRouter.post("/search", express.json({ limit: "1mb" }), async (req: Request<{}, {}, SearchRequest>, res: Response<SearchResponse | { error: string }>) => {
  if (!authenticate(req, res)) return;
  
  const { query } = req.body || {};
  
  // Validate request parameters
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "invalid_args: query is required" });
  }
  
  console.log(`[MCP] Search request: ${query}`);
  
  try {
    const safeBasePath = path.resolve(process.cwd(), "data", "mcp");
    
    // Ensure directory exists
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    
    // Read all files in the directory
    const files = await fs.promises.readdir(safeBasePath);
    const results: string[] = [];
    
    // Search through files
    for (const file of files) {
      const filePath = path.join(safeBasePath, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile()) {
        try {
          const content = await fs.promises.readFile(filePath, "utf-8");
          const lowerQuery = query.toLowerCase();
          const lowerContent = content.toLowerCase();
          const lowerFileName = file.toLowerCase();
          
          // Check if query matches filename or content
          if (lowerFileName.includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
            results.push(file); // Use filename as ID
          }
        } catch (readError) {
          console.error(`[MCP] Error reading file ${file}:`, readError);
        }
      }
    }
    
    console.log(`[MCP] Search found ${results.length} results`);
    
    const response: SearchResponse = {
      results
    };
    
    res.json(response);
  } catch (error) {
    console.error(`[MCP] Error searching files:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({ error: `Search failed: ${errorMessage}` });
  }
});

// POST /mcp/fetch - Fetch file content by ID
mcpRouter.post("/fetch", express.json({ limit: "1mb" }), async (req: Request<{}, {}, FetchRequest>, res: Response<FetchResponse | { error: string }>) => {
  if (!authenticate(req, res)) return;
  
  const { id } = req.body || {};
  
  // Validate request parameters
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "invalid_args: id is required" });
  }
  
  console.log(`[MCP] Fetch request: ${id}`);
  
  try {
    const safeBasePath = path.resolve(process.cwd(), "data", "mcp");
    
    // Sanitize the ID to prevent path traversal
    const fileName = path.basename(id);
    const filePath = path.join(safeBasePath, fileName);
    
    // Security check: ensure the resolved path is within the safe directory
    if (!filePath.startsWith(safeBasePath)) {
      console.error(`[MCP] Security violation: attempted to fetch outside safe directory: ${id}`);
      return res.status(400).json({ error: "invalid_args: invalid file ID" });
    }
    
    // Check if file exists
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return res.status(404).json({ error: `File not found: ${id}` });
    }
    
    // Read the file content
    const content = await fs.promises.readFile(filePath, "utf-8");
    const stats = await fs.promises.stat(filePath);
    
    console.log(`[MCP] Successfully fetched file: ${fileName}`);
    
    const response: FetchResponse = {
      id: fileName,
      title: fileName,
      content: content,
      metadata: {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.ctime.toISOString()
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error(`[MCP] Error fetching file:`, error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    res.status(500).json({ error: `Fetch failed: ${errorMessage}` });
  }
});

// Health check endpoint for the MCP router
mcpRouter.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "mcp" });
});