import express from "express";
import fs from "node:fs";
import path from "node:path";

const router = express.Router();
const FILE = path.join(process.cwd(), "tasks", "tasks.json");

// SSE clients storage
const sseClients = new Set();

// Load tasks from file
function loadTasks() {
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { version: 1, updated: new Date().toISOString(), tasks: [] };
  }
}

// Save tasks to file
function saveTasks(obj) {
  obj.updated = new Date().toISOString();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2), "utf8");
}

// Broadcast to all SSE clients
function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.res.write(msg);
  }
}

// GET /tasks/status.json - return current tasks
router.get("/status.json", (req, res) => {
  const tasks = loadTasks();
  res.json(tasks);
});

// POST /tasks/update - update single task
router.post("/update", (req, res) => {
  const { id, updates } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Task id required" });
  }
  
  const tasks = loadTasks();
  const task = tasks.tasks.find(t => t.id === id);
  
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  // Apply updates
  Object.assign(task, updates);
  saveTasks(tasks);
  
  // Broadcast update to SSE clients
  broadcast({ type: "update", id, updates });
  
  res.json({ success: true, task });
});

// GET /tasks/stream - SSE stream for live updates
router.get("/stream", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  
  // Send initial connection
  res.write(`:ok\n\n`);
  
  // Add client to set
  const client = { id: Date.now(), res };
  sseClients.add(client);
  
  // Send initial data
  const tasks = loadTasks();
  res.write(`data: ${JSON.stringify({ type: "init", tasks: tasks.tasks })}\n\n`);
  
  // Heartbeat every 30s
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);
  
  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

export default router;