// System tray service
// Handles system tray icon and menu for Windows

import { createRequire } from "module";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { logInfo, logError } from "../utils/logger.js";
import { PORT } from "../config/serverConfig.js";

// Import systray2 using createRequire since it's CommonJS
const require = createRequire(import.meta.url);
const SysTrayModule = require("systray2");
const SysTray = SysTrayModule.default || SysTrayModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let systray = null;
let shutdownCallback = null;

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
    // Get the path to the icon file
    const iconPath = path.join(__dirname, "..", "assets", "images", "wotti-ico.ico");

    // Create menu items
    const itemOpen = {
      title: "פתח",
      tooltip: "פתח את האפליקציה בדפדפן",
      checked: false,
      enabled: true,
      click: () => {
        openBrowser();
      },
    };

    const itemExit = {
      title: "יציאה",
      tooltip: "סגור את האפליקציה",
      checked: false,
      enabled: true,
      click: () => {
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
      },
    };

    // Initialize the system tray
    systray = new SysTray({
      menu: {
        icon: iconPath,
        title: "Wotti",
        tooltip: "Wotti - WhatsApp Integration",
        items: [itemOpen, SysTray.separator, itemExit],
      },
      debug: false,
      copyDir: false,
    });

    // Handle menu item clicks
    systray.onClick((action) => {
      if (action.item.click != null) {
        action.item.click();
      }
    });

    // Wait for system tray to be ready
    await systray.ready();
    logInfo("System tray initialized successfully");
  } catch (error) {
    logError("Failed to initialize system tray", error);
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
      systray = null;
      shutdownCallback = null;
      logInfo("System tray destroyed");
    } catch (error) {
      logError("Error destroying system tray", error);
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

