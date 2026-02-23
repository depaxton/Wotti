// Express application setup
// Configures middleware and mounts routes

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { CORS_OPTIONS } from "./config/serverConfig.js";
import apiRoutes from "./routes/apiRoutes.js";
import { logInfo, logError } from "./utils/logger.js";

const app = express();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware - CORS must be first
app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (skip /api/status to reduce noise)
app.use((req, res, next) => {
  if (req.url !== "/api/status") {
    logInfo(`${req.method} ${req.url} | Origin: ${req.headers.origin ?? "none"}`);
  }
  next();
});

// Handle preflight requests
app.options('*', cors(CORS_OPTIONS));

// Serve static files (HTML, CSS, JS, assets) - MUST be before API routes
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    // Set correct MIME type for JavaScript modules
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Mount routes
app.use("/api", apiRoutes);

// SPA fallback: serve index.html for any non-API, non-file GET request
// so URLs like /ai-settings or /profile load the app instead of 404
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logError("Request error", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

export default app;

