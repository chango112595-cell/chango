import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';

// WebSocket MCP Server for ChatGPT integration
export class MCPWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocketServer();
  }

  // Authenticate the connection using token from query string
  private authenticate(req: IncomingMessage): boolean {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const expectedToken = process.env.MCP_TOKEN || 'mcp-connect-chatgpt';
    return token === expectedToken;
  }

  // Handle WebSocket upgrade
  public handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    if (!this.authenticate(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[MCP-WS] New connection established');
      this.clients.add(ws);

      // Send initial connection message
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'connection.established',
        params: {
          protocolVersion: '1.0',
          serverName: 'ChangoAI MCP Server',
          serverVersion: '1.0.0'
        }
      }));

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[MCP-WS] Received:', message);
          
          const response = await this.handleJsonRpcMessage(message);
          ws.send(JSON.stringify(response));
        } catch (error) {
          console.error('[MCP-WS] Error handling message:', error);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error'
            },
            id: null
          }));
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('[MCP-WS] Connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[MCP-WS] WebSocket error:', error);
      });

      // Keep-alive ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });
  }

  // Handle JSON-RPC messages
  private async handleJsonRpcMessage(message: any): Promise<any> {
    const { method, params, id } = message;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '1.0',
            serverName: 'ChangoAI MCP Server',
            serverVersion: '1.0.0',
            capabilities: {
              tools: ['list_files', 'read_file', 'write_file']
            }
          },
          id
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          result: {
            tools: [
              {
                name: 'list_files',
                description: 'List files in the project directory',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      description: 'Directory path to list (relative to project root)'
                    }
                  }
                }
              },
              {
                name: 'read_file',
                description: 'Read the contents of a file (read-only)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      description: 'File path to read (relative to project root)'
                    }
                  },
                  required: ['path']
                }
              },
              {
                name: 'write_file',
                description: 'Write content to a file (isolated to data/mcp directory)',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      description: 'File path to write (relative to data/mcp)'
                    },
                    content: {
                      type: 'string',
                      description: 'Content to write to the file'
                    }
                  },
                  required: ['path', 'content']
                }
              }
            ]
          },
          id
        };

      case 'tools/call':
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        
        try {
          const result = await this.executeTool(toolName, toolArgs);
          return {
            jsonrpc: '2.0',
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            },
            id
          };
        } catch (error: any) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: error.message || 'Tool execution failed'
            },
            id
          };
        }

      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found'
          },
          id
        };
    }
  }

  // Execute MCP tools
  private async executeTool(toolName: string, args: any): Promise<any> {
    const projectRoot = process.cwd();
    
    switch (toolName) {
      case 'list_files':
        const listPath = path.join(projectRoot, args.path || '');
        try {
          const items = await fs.readdir(listPath, { withFileTypes: true });
          return {
            path: args.path || '/',
            files: items.map(item => ({
              name: item.name,
              type: item.isDirectory() ? 'directory' : 'file'
            }))
          };
        } catch (error: any) {
          throw new Error(`Failed to list files: ${error.message}`);
        }

      case 'read_file':
        if (!args.path) {
          throw new Error('File path is required');
        }
        const readPath = path.join(projectRoot, args.path);
        // Ensure we're not reading outside project directory
        if (!readPath.startsWith(projectRoot)) {
          throw new Error('Invalid file path');
        }
        try {
          const content = await fs.readFile(readPath, 'utf-8');
          return {
            path: args.path,
            content
          };
        } catch (error: any) {
          throw new Error(`Failed to read file: ${error.message}`);
        }

      case 'write_file':
        if (!args.path || !args.content) {
          throw new Error('File path and content are required');
        }
        // Isolate writes to data/mcp directory
        const safeDir = path.join(projectRoot, 'data', 'mcp');
        const writePath = path.join(safeDir, args.path);
        
        // Ensure we're writing within the safe directory
        if (!writePath.startsWith(safeDir)) {
          throw new Error('Invalid write path');
        }
        
        try {
          await fs.mkdir(path.dirname(writePath), { recursive: true });
          await fs.writeFile(writePath, args.content, 'utf-8');
          return {
            path: args.path,
            written: true,
            fullPath: writePath
          };
        } catch (error: any) {
          throw new Error(`Failed to write file: ${error.message}`);
        }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Broadcast message to all connected clients
  public broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}