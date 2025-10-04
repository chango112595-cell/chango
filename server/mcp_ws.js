// server/mcp_ws.js
import { WebSocketServer } from "ws";
export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: "/mcp/ws" });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({
      type: "ready",
      tools: [
        { name: "list_files", args: { path: "string" } },
        { name: "read_file", args: { path: "string" } },
        { name: "write_file", args: { path: "string", content: "string" } },
      ],
    }));
    const ping = setInterval(() => ws.send(JSON.stringify({ type: "ping" })), 15000);
    ws.on("close", () => clearInterval(ping));
  });
}