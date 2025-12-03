// Restart service
// Handles graceful shutdown and restart of the application

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { destroyClient } from "./whatsappClient.js";
import { stopScheduler } from "./reminderScheduler.js";
import { stopUpdateChecker } from "./updateService.js";
import { destroySystemTray } from "./systemTray.js";
import { cleanupAllProcesses } from "../utils/processCleanup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Store server instance for restart
let serverInstance = null;

/**
 * Sets the server instance for restart functionality
 * @param {Object} server - Express server instance
 */
export function setServerInstance(server) {
  serverInstance = server;
}

/**
 * Gets the server instance
 * @returns {Object|null} Server instance or null
 */
function getServerInstance() {
  return serverInstance;
}

/**
 * Performs graceful shutdown of all services
 * @param {Object} server - Express server instance
 * @returns {Promise<void>}
 */
async function gracefulShutdown(server) {
  try {
    logInfo("Starting graceful shutdown for restart...");

    // Stop scheduler first
    stopScheduler();

    // Stop update checker
    stopUpdateChecker();

    // Close HTTP server
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          logInfo("HTTP server closed");
          resolve();
        });
        // Force close after 5 seconds if graceful close doesn't work
        setTimeout(() => {
          logWarn("HTTP server close timeout, forcing shutdown");
          resolve();
        }, 5000);
      });
    }

    // Destroy WhatsApp client (closes the browser and Puppeteer)
    await destroyClient();

    // Destroy system tray icon
    await destroySystemTray();

    // Wait a bit for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Comprehensive cleanup of all processes and ports
    await cleanupAllProcesses();

    logInfo("Graceful shutdown complete");
  } catch (error) {
    logError("Error during graceful shutdown", error);
    // Continue anyway - we still want to restart
  }
}

/**
 * Restarts the application by spawning a new process and exiting the current one
 * @returns {Promise<void>}
 */
export async function restartApplication() {
  try {
    logInfo("Restart requested. Initiating restart sequence...");

    const server = getServerInstance();
    if (!server) {
      throw new Error("Server instance not available");
    }

    // Perform graceful shutdown first
    await gracefulShutdown(server);

    // Wait a bit more to ensure everything is closed
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const scriptPath = path.join(PROJECT_ROOT, "index.js");

    logInfo("Spawning new process to restart application...");

    // Spawn new Node.js process directly
    // Using detached: true ensures the child process continues after parent exits
    const child = spawn("node", [scriptPath], {
      detached: true,
      stdio: "ignore",
      cwd: PROJECT_ROOT,
      env: process.env,
    });

    // Unref the child process so parent can exit without waiting
    child.unref();

    logInfo("New process spawned. Exiting current process...");
    
    // Give the new process time to start (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Exit current process
    process.exit(0);
  } catch (error) {
    logError("Error during restart", error);
    throw error;
  }
}

