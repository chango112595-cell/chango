import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables

// Initialize OpenAI client with API key from environment variable
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });
  next();
});
// ChatGPT endpoint using OpenAI SDK
app.post('/chatgpt', async (req: Request, res: Response) => {
    const userMessage = req.body.message;
    
    // Validate input
    if (!userMessage) {
        return res.status(400).json({ 
            error: 'Bad Request',
            message: 'Message is required in the request body' 
        });
    }
    
    try {
        // Make a request to OpenAI using the SDK
        // Note: gpt-5 is the newest OpenAI model, released August 7, 2025
        const response = await openai.chat.completions.create({
            model: 'gpt-5', // Using the latest model (released August 7, 2025)
            messages: [{ role: 'user', content: userMessage }]
        });
        
        const botMessage = response.choices[0].message.content;
        res.json({ reply: botMessage });
    } catch (error: any) {
        // Enhanced error handling with specific handling for rate limits
        console.error('OpenAI API Error:', error);
        
        // Check if it's a rate limit error (429)
        if (error.status === 429) {
            return res.status(429).json({ 
                error: 'Rate Limit Exceeded',
                message: 'Too many requests. Please wait a moment and try again.',
                retryAfter: error.headers?.['retry-after'] || '60 seconds'
            });
        }
        
        // Check for authentication errors
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'Authentication Error',
                message: 'Invalid API key. Please check your OpenAI configuration.'
            });
        }
        
        // Check for invalid request errors
        if (error.status === 400) {
            return res.status(400).json({ 
                error: 'Invalid Request',
                message: error.message || 'The request to OpenAI was invalid.'
            });
        }
        
        // Default error response for other errors
        res.status(error.status || 500).json({ 
            error: 'API Error',
            message: error.message || 'An error occurred while communicating with the OpenAI API'
        });
    }
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();