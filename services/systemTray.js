// System tray service
// Handles system tray icon and menu for Windows

import { createRequire } from "module";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { PORT } from "../config/serverConfig.js";

const execPromise = promisify(exec);

// Import systray2 using createRequire since it's CommonJS
const require = createRequire(import.meta.url);
const SysTrayModule = require("systray2");
const SysTray = SysTrayModule.default || SysTrayModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let systray = null;
let shutdownCallback = null;

/**
 * Kills any existing systray processes (tray_windows_release.exe)
 * This is necessary because systray2 may leave orphaned processes
 * @returns {Promise<void>}
 */
async function killExistingSystrayProcesses() {
  if (os.platform() !== "win32") {
    return;
  }

  try {
    // Find all tray_windows_release.exe processes
    try {
      const { stdout } = await execPromise('tasklist /FI "IMAGENAME eq tray_windows_release.exe" /FO CSV /NH');
      
      if (stdout && stdout.trim() && !stdout.includes("INFO: No tasks")) {
        logInfo("Found existing systray processes, killing them...");
        
        // Kill all tray_windows_release.exe processes
        await execPromise('taskkill /F /IM tray_windows_release.exe /T');
        logInfo("Killed existing systray processes");
        
        // Wait a bit for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      // No processes found or already killed - this is fine
      if (!error.message.includes("No tasks") && !error.message.includes("not found")) {
        // Silent - no processes to kill
      }
    }
  } catch (error) {
    logWarn("Could not check for existing systray processes:", error.message);
    // Continue anyway - not critical
  }
}

/**
 * Opens the application URL in the default browser
 */
function openBrowser() {
  const url = `http://localhost:${PORT}`;
  logInfo(`Opening browser to ${url}`);

  let command;
  if (os.platform() === "win32") {
    command = `start ${url}`;
  } else if (os.platform() === "darwin") {
    command = `open ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }

  exec(command, (error) => {
    if (error) {
      logError("Failed to open browser", error);
    } else {
      logInfo("Browser opened successfully");
    }
  });
}

/**
 * Initializes the system tray
 * @param {Function} onShutdown - Callback function to call when Exit is clicked
 * @returns {Promise<void>}
 */
export async function initializeSystemTray(onShutdown) {
  if (systray) {
    logInfo("System tray already initialized");
    return;
  }

  if (os.platform() !== "win32") {
    logInfo("System tray is only supported on Windows. Skipping tray initialization.");
    return;
  }

  shutdownCallback = onShutdown;

  try {
    // Kill any existing systray processes before creating a new one
    // This prevents issues with orphaned processes from previous runs
    await killExistingSystrayProcesses();
    // Get the absolute path to the icon file
    const iconPath = path.resolve(__dirname, "..", "assets", "images", "wotti-ico.ico");
    
    // Verify icon file exists
    if (!fs.existsSync(iconPath)) {
      logError(`Icon file not found at: ${iconPath}`);
      return;
    }
    
    // Try multiple path formats for systray2 compatibility
    // Windows systray2 may prefer forward slashes or relative paths
    const normalizedIconPath = iconPath.replace(/\\/g, "/");
    const relativeIconPath = path.relative(process.cwd(), iconPath).replace(/\\/g, "/");
    
    // Use absolute path with forward slashes (most reliable for Windows)
    const iconPathForTray = normalizedIconPath;
    
    logInfo(`Icon file found: ${iconPath}`);
    logInfo(`Using icon path for tray: ${iconPathForTray}`);
    logInfo(`Icon file size: ${fs.statSync(iconPath).size} bytes`);

    // Create menu items - make sure they don't have click handlers in the object
    // The click handlers will be handled by onClick event
    const itemOpen = {
      title: "פתח",
      tooltip: "פתח את האפליקציה בדפדפן",
      checked: false,
      enabled: true,
    };

    const itemExit = {
      title: "יציאה",
      tooltip: "סגור את האפליקציה",
      checked: false,
      enabled: true,
    };

    // Initialize the system tray
    // systray2 expects a file path (not base64) - use normalized absolute path for Windows
    systray = new SysTray({
      menu: {
        icon: normalizedIconPath, // Use normalized absolute path for Windows compatibility
        title: "Wotti",
        tooltip: "Wotti - WhatsApp Integration",
        items: [itemOpen, SysTray.separator, itemExit],
      },
      debug: false, // Set to false to use tray_windows_release.exe (production build)
      copyDir: false,
    });

    // Wait for system tray to be ready BEFORE setting up onClick handler
    await systray.ready();
    logInfo("System tray ready, setting up click handlers...");

    // Handle menu item clicks - must be called AFTER ready()
    systray.onClick((action) => {
      logInfo(`System tray menu item clicked: ${action.item.title}`);
      
      if (action.item.title === "פתח") {
        openBrowser();
      } else if (action.item.title === "יציאה") {
        logInfo("Exit requested from system tray");
        if (shutdownCallback) {
          shutdownCallback();
        } else {
          // Fallback if no callback is set
          if (systray) {
            systray.kill(false);
          }
          process.exit(0);
        }
      }
    });

    // Also handle errors
    systray.onError((error) => {
      logError("System tray error:", error);
    });

    logInfo("System tray initialized successfully");
  } catch (error) {
    logError("Failed to initialize system tray", error);
    logError("Error details:", error.stack);
    // Don't throw - allow application to continue without tray
  }
}

/**
 * Destroys the system tray icon
 * @returns {Promise<void>}
 */
export async function destroySystemTray() {
  if (systray) {
    try {
      logInfo("Destroying system tray...");
      systray.kill(false);
      
      // Wait a bit for the process to terminate
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force kill any remaining systray processes
      await killExistingSystrayProcesses();
      
      systray = null;
      shutdownCallback = null;
      logInfo("System tray destroyed");
    } catch (error) {
      logError("Error destroying system tray", error);
      // Try to force kill anyway
      try {
        await killExistingSystrayProcesses();
      } catch (killError) {
        // Ignore errors during cleanup
      }
      systray = null;
      shutdownCallback = null;
    }
  }
}

/**
 * Checks if system tray is initialized
 * @returns {boolean}
 */
export function isSystemTrayInitialized() {
  return systray !== null;
}

