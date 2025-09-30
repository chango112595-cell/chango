import type { Request, Response, Express } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';

const auditLogFile = path.join(process.cwd(), 'logs/voice_audit.log');

export function auditRoutes(app: Express) {
  // Ensure logs directory exists
  const logsDir = path.dirname(auditLogFile);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Voice audit logging endpoint
  app.post('/api/logs', express.text({ type: '*/*' }), (req: Request, res: Response) => {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${req.body}\n`;
      
      // Append to log file
      fs.appendFileSync(auditLogFile, logEntry);
      
      // Send success response
      res.sendStatus(204);
    } catch (error) {
      console.error('Failed to write audit log:', error);
      res.status(500).json({ error: 'Failed to write audit log' });
    }
  });
  
  // Get audit logs endpoint (for debugging)
  app.get('/api/logs', (req: Request, res: Response) => {
    try {
      if (!fs.existsSync(auditLogFile)) {
        res.json({ logs: [] });
        return;
      }
      
      // Read last 100 lines
      const content = fs.readFileSync(auditLogFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const lastLines = lines.slice(-100);
      
      res.json({ 
        logs: lastLines.map(line => {
          // Try to parse JSON from log entry
          const match = line.match(/\[(.*?)\] (.*)/);
          if (match) {
            try {
              return {
                timestamp: match[1],
                data: JSON.parse(match[2])
              };
            } catch {
              return {
                timestamp: match[1],
                data: match[2]
              };
            }
          }
          return { raw: line };
        })
      });
    } catch (error) {
      console.error('Failed to read audit logs:', error);
      res.status(500).json({ error: 'Failed to read audit logs' });
    }
  });
  
  // Clear audit logs endpoint (for cleanup)
  app.delete('/api/logs', (req: Request, res: Response) => {
    try {
      if (fs.existsSync(auditLogFile)) {
        fs.truncateSync(auditLogFile, 0);
      }
      res.json({ message: 'Audit logs cleared' });
    } catch (error) {
      console.error('Failed to clear audit logs:', error);
      res.status(500).json({ error: 'Failed to clear audit logs' });
    }
  });
}