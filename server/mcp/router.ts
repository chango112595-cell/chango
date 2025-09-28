import express, { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// JSON-RPC 2.0 Types
interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: string | number;
}

interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

// SSE Connection management
interface SSEConnection {
  res: Response;
  connectionId: string;
  keepAliveInterval?: NodeJS.Timeout;
}

const sseConnections = new Map<string, SSEConnection>();
let connectionCounter = 0;

// MCP Tool Types
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface ToolsListResult {
  tools: Tool[];
}

interface ToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

// Create router instance
export const mcpRouter: Router = express.Router();

// MCP data storage
const safeBasePath = path.resolve(process.cwd(), "data", "mcp");

// Authentication function that supports both Bearer token and query parameter
function getToken(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.query.token as string | undefined;
}

function authenticate(req: Request, res: Response): boolean {
  // Check if request is from ChatGPT origin
  const origin = req.headers.origin as string;
  const chatGPTOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  
  // If origin is ChatGPT and no token provided, allow access
  const token = getToken(req);
  if (!token && chatGPTOrigins.has(origin)) {
    return true;
  }
  
  // Otherwise, verify token
  const expectedToken = process.env.MCP_TOKEN || "mcp-connect-chatgpt";
  
  if (token !== expectedToken) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  
  return true;
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "search",
    description: "Search for files and content in the MCP storage. Returns matching file IDs.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find matching files"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch",
    description: "Fetch the complete content of a file by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "File ID to fetch content for"
        }
      },
      required: ["id"]
    }
  },
  {
    name: "write_file",
    description: "Create or overwrite a UTF-8 text file in the MCP storage.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to write to"
        },
        content: {
          type: "string",
          description: "Content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  }
];

// Tool implementation functions
async function searchFiles(query: string): Promise<{ ids: string[] }> {
  try {
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    const files = await fs.promises.readdir(safeBasePath);
    const results: string[] = [];
    
    for (const file of files) {
      const filePath = path.join(safeBasePath, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile()) {
        try {
          const content = await fs.promises.readFile(filePath, "utf-8");
          const lowerQuery = query.toLowerCase();
          const lowerContent = content.toLowerCase();
          const lowerFileName = file.toLowerCase();
          
          if (lowerFileName.includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
            results.push(file);
          }
        } catch (readError) {
          console.error(`[MCP] Error reading file ${file}:`, readError);
        }
      }
    }
    
    return { ids: results };
  } catch (error) {
    console.error(`[MCP] Error searching files:`, error);
    throw error;
  }
}

async function fetchFile(id: string): Promise<{ id: string; title: string; content: string; metadata: any }> {
  try {
    const fileName = path.basename(id);
    const filePath = path.join(safeBasePath, fileName);
    
    if (!filePath.startsWith(safeBasePath)) {
      throw new Error("Invalid file ID");
    }
    
    await fs.promises.access(filePath, fs.constants.R_OK);
    const content = await fs.promises.readFile(filePath, "utf-8");
    const stats = await fs.promises.stat(filePath);
    
    return {
      id: fileName,
      title: fileName,
      content: content,
      metadata: {
        size: stats.size,
        modified: stats.mtime.toISOString(),
        created: stats.ctime.toISOString()
      }
    };
  } catch (error) {
    console.error(`[MCP] Error fetching file:`, error);
    throw error;
  }
}

async function writeFile(filePath: string, content: string): Promise<number> {
  try {
    const fileName = path.basename(filePath);
    const fullPath = path.join(safeBasePath, fileName);
    
    if (!fullPath.startsWith(safeBasePath)) {
      throw new Error("Path traversal detected");
    }
    
    await fs.promises.mkdir(safeBasePath, { recursive: true });
    await fs.promises.writeFile(fullPath, content, "utf-8");
    
    return content.length;
  } catch (error) {
    console.error(`[MCP] Error writing file:`, error);
    throw error;
  }
}

// JSON-RPC 2.0 Main Handler
async function handleJSONRPC(request: JSONRPCRequest): Promise<JSONRPCResponse> {
  console.log(`[MCP] JSON-RPC request: ${request.method}`);
  
  try {
    switch (request.method) {
      case "tools/list":
        return {
          jsonrpc: "2.0",
          result: { tools: TOOLS },
          id: request.id
        };
      
      case "tools/call":
        const params = request.params as ToolCallParams;
        if (!params || !params.name || !params.arguments) {
          throw {
            code: -32602,
            message: "Invalid params: name and arguments required"
          };
        }
        
        let result: ToolCallResult;
        
        switch (params.name) {
          case "search":
            const searchResults = await searchFiles(params.arguments.query);
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(searchResults)
              }]
            };
            break;
          
          case "fetch":
            const fileData = await fetchFile(params.arguments.id);
            result = {
              content: [{
                type: "text",
                text: JSON.stringify(fileData)
              }]
            };
            break;
          
          case "write_file":
            const written = await writeFile(params.arguments.path, params.arguments.content);
            result = {
              content: [{
                type: "text",
                text: `Successfully wrote ${written} bytes to ${params.arguments.path}`
              }]
            };
            break;
          
          default:
            throw {
              code: -32601,
              message: `Method not found: ${params.name}`
            };
        }
        
        return {
          jsonrpc: "2.0",
          result,
          id: request.id
        };
      
      default:
        throw {
          code: -32601,
          message: `Method not found: ${request.method}`
        };
    }
  } catch (error: any) {
    console.error(`[MCP] Error processing request:`, error);
    
    if (error && typeof error.code === "number") {
      return {
        jsonrpc: "2.0",
        error: {
          code: error.code,
          message: error.message,
          data: error.data
        },
        id: request.id
      };
    }
    
    return {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error)
      },
      id: request.id
    };
  }
}

// POST /mcp - Main JSON-RPC endpoint
mcpRouter.post("/", express.json({ limit: "1mb" }), async (req: Request<{}, {}, JSONRPCRequest>, res: Response<JSONRPCResponse>) => {
  if (!authenticate(req, res)) return;
  
  // Set CORS headers for POST response
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const request = req.body;
  
  // Validate JSON-RPC request
  if (!request || request.jsonrpc !== "2.0" || !request.method || request.id === undefined) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request"
      },
      id: null as any
    });
  }
  
  const response = await handleJSONRPC(request);
  res.json(response);
});

// GET /mcp - Legacy discovery endpoint (for backward compatibility)
mcpRouter.get("/", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] Legacy discovery endpoint called`);
  
  // Return a simple discovery response for testing
  res.json({
    tools: TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description
    }))
  });
});

// Health check endpoint for the MCP router
mcpRouter.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "mcp", protocol: "json-rpc-2.0" });
});

// SSE helper functions
function sendSSEMessage(res: Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function setupSSEConnection(req: Request, res: Response): string {
  // CORS headers for ChatGPT
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': '*',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });
  
  // Send initial ready event required by ChatGPT
  const connectionId = `sse-${Date.now()}-${++connectionCounter}`;
  const readyEvent = {
    type: 'ready',
    tools: TOOLS.map(tool => ({
      name: tool.name,
      args: Object.keys(tool.inputSchema.properties || {}).reduce((acc, key) => {
        acc[key] = "string";
        return acc;
      }, {} as Record<string, string>)
    })),
    meta: { project: "ChangoAI", connectionId }
  };
  sendSSEMessage(res, readyEvent);
  
  return connectionId;
}

// OPTIONS handler for SSE endpoint preflight
mcpRouter.options("/sse", (req: Request, res: Response) => {
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

mcpRouter.options("/sse/", (req: Request, res: Response) => {
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

// GET /sse - SSE endpoint for ChatGPT (without trailing slash)
mcpRouter.get("/sse", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] SSE connection established (no trailing slash)`);
  
  const connectionId = setupSSEConnection(req, res);
  
  // Set up keep-alive ping every 15 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch (error) {
      // Connection closed, clean up
      clearInterval(keepAliveInterval);
      sseConnections.delete(connectionId);
    }
  }, 15000);
  
  // Store connection
  sseConnections.set(connectionId, {
    res,
    connectionId,
    keepAliveInterval
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`[MCP] SSE connection closed: ${connectionId}`);
    clearInterval(keepAliveInterval);
    sseConnections.delete(connectionId);
  });
});

// GET /sse/ - SSE endpoint for ChatGPT (with trailing slash)
mcpRouter.get("/sse/", (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  console.log(`[MCP] SSE connection established (with trailing slash)`);
  
  const connectionId = setupSSEConnection(req, res);
  
  // Set up keep-alive ping every 15 seconds
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(`:ping\n\n`);
    } catch (error) {
      // Connection closed, clean up
      clearInterval(keepAliveInterval);
      sseConnections.delete(connectionId);
    }
  }, 15000);
  
  // Store connection
  sseConnections.set(connectionId, {
    res,
    connectionId,
    keepAliveInterval
  });
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`[MCP] SSE connection closed: ${connectionId}`);
    clearInterval(keepAliveInterval);
    sseConnections.delete(connectionId);
  });
});

// OPTIONS handler for messages endpoint preflight
mcpRouter.options("/messages", (req: Request, res: Response) => {
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.status(204).end();
});

// POST /messages - JSON-RPC message endpoint for ChatGPT
mcpRouter.post("/messages", express.json({ limit: "1mb" }), async (req: Request, res: Response) => {
  if (!authenticate(req, res)) return;
  
  // Set CORS headers for POST response
  const origin = req.headers.origin as string;
  const allowedOrigins = new Set(["https://chat.openai.com", "app://chat.openai.com"]);
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://chat.openai.com";
  
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const request = req.body as JSONRPCRequest;
  
  console.log(`[MCP] Message received via /messages: ${request.method}`);
  
  // Validate JSON-RPC request
  if (!request || request.jsonrpc !== "2.0" || !request.method || request.id === undefined) {
    return res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request"
      },
      id: null as any
    });
  }
  
  // Process the request using existing handler
  const response = await handleJSONRPC(request);
  
  // Return response directly (simplified strategy - no SSE response delivery)
  res.json(response);
});