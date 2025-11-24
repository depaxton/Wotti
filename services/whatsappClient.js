// WhatsApp client service
// Handles client initialization, QR code display, and event listeners

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";

let client = null;
let currentQRCode = null;
let qrCodeCallbacks = [];
let isReinitializing = false;
let hasNewMessage = false; // Flag to track if a new message was received

/**
 * Clears the authentication session files
 * This is needed when a device is unlinked from WhatsApp
 * Handles EBUSY errors by retrying after delays
 */
async function clearAuthSession(retries = 5, delay = 1000) {
  const authPath = path.join(process.cwd(), ".wwebjs_auth");

  // Check if directory exists
  try {
    await fs.access(authPath);
  } catch (error) {
    // Directory doesn't exist, nothing to clear
    logInfo("No authentication session files to clear");
    return;
  }

  // Try to remove the directory with retry logic for locked files
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logInfo(`Clearing authentication session files... (attempt ${attempt}/${retries})`);

      // Remove directory and all its contents
      await fs.rm(authPath, { recursive: true, force: true });

      logInfo("Authentication session files cleared successfully");
      return; // Success, exit the function
    } catch (error) {
      const isEBUSY = error.code === "EBUSY" || error.code === "EPERM" || error.message?.includes("locked");

      if (isEBUSY && attempt < retries) {
        // File is locked, wait and retry
        logWarn(`Files are locked, waiting ${delay}ms before retry (attempt ${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        // Increase delay for next retry (exponential backoff)
        delay *= 1.5;
      } else if (isEBUSY && attempt === retries) {
        // Last attempt failed, log warning but don't throw
        logWarn(`Failed to clear session files after ${retries} attempts. Files may be locked by browser.`);
        logWarn("Session files will be cleared on next restart or when browser closes.");
        // Don't throw - this is not a critical error, the files will be cleared eventually
        return;
      } else {
        // Different error, log and re-throw
        logError("Error clearing authentication session", error);
        throw error;
      }
    }
  }
}

/**
 * Initializes the WhatsApp client
 * @param {boolean} forceReinit - Force reinitialization even if client exists
 * @returns {Promise<Client>} Initialized client instance
 */
export async function initializeClient(forceReinit = false) {
  if (client && !forceReinit) {
    return client;
  }

  // If forcing reinit, destroy existing client first
  if (forceReinit && client) {
    try {
      logInfo("Destroying existing client for reinitialization...");
      await client.destroy();
      client = null;
      currentQRCode = null;
    } catch (error) {
      logWarn("Error destroying client:", error);
      client = null;
      currentQRCode = null;
    }
  }

  try {
    logInfo("Initializing WhatsApp client...");

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: ".wwebjs_auth",
      }),
      puppeteer: {
        headless: false, // Set to false to see browser (for debugging)
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-web-security",
        ],
      },
      webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
      },
    });

    // Register event listeners
    registerEventListeners(client);

    // Initialize the client
    await client.initialize();

    logInfo("WhatsApp client initialized successfully");
    return client;
  } catch (error) {
    logError("Failed to initialize WhatsApp client", error);
    client = null;
    throw error;
  }
}

/**
 * Starts monitoring the WhatsApp page for "טוען" (loading) text
 * Updates status to "loading" when detected
 * @param {Client} clientInstance - WhatsApp client instance
 */
async function startLoadingDetection(clientInstance) {
  try {
    // Wait a bit for the page to be ready after authentication
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get the Puppeteer page from the client
    // Try different ways to access the page with retries
    let page = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!page && attempts < maxAttempts) {
      try {
        if (clientInstance.pupPage) {
          page = clientInstance.pupPage;
        } else if (clientInstance.pupBrowser) {
          const pages = await clientInstance.pupBrowser.pages();
          page = pages[0]; // Get the first page
        } else if (clientInstance._pupPage) {
          page = clientInstance._pupPage;
        }
        
        if (page && !page.isClosed()) {
          break; // Found a valid page
        } else {
          page = null; // Reset if page is closed
        }
      } catch (error) {
        // Continue trying
      }
      
      if (!page) {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
        }
      }
    }
    
    if (!page) {
      logWarn("Could not access Puppeteer page for loading detection after multiple attempts");
      return;
    }

    // Function to check for "טוען" text on the page
    const checkForLoadingText = async () => {
      try {
        // Check if page is still available
        if (page.isClosed()) {
          return;
        }

        // Get page content and check for loading text using solution 3 - search all elements
        const pageContent = await page.evaluate(() => {
          // Solution 3: Search through all elements in the page
          const allElements = document.querySelectorAll('*');
          const searchTexts = [
            'הצ\'אטים בטעינה',
            'הצ'אטים בטעינה',
            'בטעינה',
            'הצ\'אטים',
            'טעינה',
            'טעינת',
            'Loading',
            'Loading chats'
          ];
          
          for (const element of allElements) {
            const text = element.innerText || element.textContent || '';
            if (searchTexts.some(searchText => text.includes(searchText))) {
              return true;
            }
          }
          
          return false;
        });

        if (pageContent) {
          logInfo("Detected 'טעינה' (loading) text on WhatsApp page");
          // Update status to loading
          qrCodeCallbacks.forEach((callback) => callback(null, "loading"));
          
          // Stop checking once we've detected loading
          return;
        }

        // Continue checking every 500ms for up to 10 seconds
        // (in case the text appears later)
        let attempts = 0;
        const maxAttempts = 20; // 20 * 500ms = 10 seconds
        
        const interval = setInterval(async () => {
          try {
            if (page.isClosed()) {
              clearInterval(interval);
              return;
            }

            attempts++;
            
            const hasLoadingText = await page.evaluate(() => {
              // Solution 3: Search through all elements in the page
              const allElements = document.querySelectorAll('*');
              const searchTexts = [
                'הצ\'אטים בטעינה',
                'הצ'אטים בטעינה',
                'בטעינה',
                'הצ\'אטים',
                'טעינה',
                'טעינת',
                'Loading',
                'Loading chats'
              ];
              
              for (const element of allElements) {
                const text = element.innerText || element.textContent || '';
                if (searchTexts.some(searchText => text.includes(searchText))) {
                  return true;
                }
              }
              
              return false;
            });

            if (hasLoadingText) {
              logInfo("Detected 'טעינה' (loading) text on WhatsApp page");
              qrCodeCallbacks.forEach((callback) => callback(null, "loading"));
              clearInterval(interval);
            } else if (attempts >= maxAttempts) {
              // Stop checking after max attempts
              clearInterval(interval);
            }
          } catch (error) {
            // Page might be closed or navigated away
            clearInterval(interval);
          }
        }, 500);
      } catch (error) {
        logWarn("Error checking for loading text:", error.message);
      }
    };

    // Start checking
    checkForLoadingText();
  } catch (error) {
    logWarn("Could not start loading detection:", error.message);
  }
}

/**
 * Registers event listeners for the WhatsApp client
 * @param {Client} clientInstance - WhatsApp client instance
 */
function registerEventListeners(clientInstance) {
  // QR code generation event
  clientInstance.on("qr", (qr) => {
    logInfo("QR code generated. Please scan with your WhatsApp mobile app:");
    qrcode.generate(qr, { small: true });

    // Store QR code for API access
    currentQRCode = qr;

    // Notify all callbacks
    qrCodeCallbacks.forEach((callback) => callback(qr));
  });

  // Authentication event
  clientInstance.on("authenticated", async () => {
    logInfo("Client authenticated successfully");
    currentQRCode = null; // Clear QR code after authentication
    qrCodeCallbacks.forEach((callback) => callback(null, "authenticated"));
    
    // Start monitoring for "טוען" (loading) text on the page
    startLoadingDetection(clientInstance);
  });

  // Ready event
  clientInstance.on("ready", () => {
    logInfo("WhatsApp client is ready!");
    currentQRCode = null; // Clear QR code when ready
    qrCodeCallbacks.forEach((callback) => callback(null, "ready"));
  });

  // Authentication failure event
  clientInstance.on("auth_failure", async (msg) => {
    logError("Authentication failed", new Error(msg));

    // Store reference to client for destruction
    const clientToDestroy = client;

    // Reset client reference first to prevent new operations
    client = null;
    currentQRCode = null;

    // Notify callbacks
    qrCodeCallbacks.forEach((callback) => callback(null, "auth_failure", msg));

    // Destroy the client first to close the browser and release file locks
    if (clientToDestroy) {
      try {
        logInfo("Destroying client after auth failure to release file locks...");
        await clientToDestroy.destroy();
        logInfo("Client destroyed successfully");
      } catch (error) {
        logWarn("Error destroying client (may already be destroyed):", error);
      }
    }

    // Wait a bit for the browser to fully close and release file locks
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clear invalid session files - they are no longer valid
    try {
      await clearAuthSession();
    } catch (error) {
      logWarn("Failed to clear session files immediately, will retry later:", error.message);
      // Continue anyway - files might be cleared on next restart
    }

    // Reinitialize after a delay to generate new QR
    if (!isReinitializing) {
      logInfo("Reinitializing client after authentication failure...");
      isReinitializing = true;

      setTimeout(async () => {
        try {
          await initializeClient(true);
          isReinitializing = false;
        } catch (error) {
          logError("Failed to reinitialize client after auth failure", error);
          isReinitializing = false;
          qrCodeCallbacks.forEach((callback) => callback(null, "error", error.message));
        }
      }, 1000);
    }
  });

  // Disconnected event
  clientInstance.on("disconnected", async (reason) => {
    logWarn(`Client disconnected: ${reason}`);
    currentQRCode = null;
    qrCodeCallbacks.forEach((callback) => callback(null, "disconnected", reason));

    // Handle all disconnect reasons - when device is unlinked from WhatsApp mobile,
    // we need to clear the session files and generate a new QR code
    // LOGOUT = user logged out, NAVIGATION = page navigation error
    // Any disconnect means we should clear session and reinitialize
    if (!isReinitializing) {
      logInfo(`Client disconnected (${reason}). Destroying client and clearing session...`);
      isReinitializing = true;

      // Store reference to client for destruction
      const clientToDestroy = client;

      // Reset client reference first to prevent new operations
      client = null;

      // Destroy the client first to close the browser and release file locks
      if (clientToDestroy) {
        try {
          logInfo("Destroying client to release file locks...");
          await clientToDestroy.destroy();
          logInfo("Client destroyed successfully");
        } catch (error) {
          logWarn("Error destroying client (may already be destroyed):", error);
        }
      }

      // Wait a bit for the browser to fully close and release file locks
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Now try to clear auth session (with retry logic for locked files)
      try {
        await clearAuthSession();
      } catch (error) {
        logWarn("Failed to clear session files immediately, will retry later:", error.message);
        // Continue anyway - files might be cleared on next restart
      }

      // Wait a bit more before reinitializing to ensure everything is cleaned up
      setTimeout(async () => {
        try {
          await initializeClient(true);
          isReinitializing = false;
        } catch (error) {
          logError("Failed to reinitialize client after disconnect", error);
          isReinitializing = false;
          // Notify callbacks of the error
          qrCodeCallbacks.forEach((callback) => callback(null, "error", error.message));
        }
      }, 1000);
    }
  });

  // Error event
  clientInstance.on("error", (error) => {
    logError("Client error occurred", error);
    qrCodeCallbacks.forEach((callback) => callback(null, "error", error.message));
  });

  // Message event - listen for incoming messages
  clientInstance.on("message", (message) => {
    // Only track messages that are not from the current user (incoming messages)
    if (message.fromMe === false) {
      logInfo(`New incoming message received from ${message.from}`);
      hasNewMessage = true;
    }
  });
}

/**
 * Gets the current client instance
 * @returns {Client|null} Client instance or null if not initialized
 */
export function getClient() {
  return client;
}

/**
 * Checks if the client is ready
 * @returns {Promise<boolean>} True if client is ready, false otherwise
 */
export async function isClientReady() {
  if (!client) {
    return false;
  }

  try {
    const state = await client.getState();
    return state === "CONNECTED";
  } catch (error) {
    logError("Error checking client state", error);
    return false;
  }
}

/**
 * Destroys the WhatsApp client instance
 * This properly closes the browser and cleans up resources
 */
export async function destroyClient() {
  if (client) {
    try {
      logInfo("Destroying WhatsApp client...");
      await client.destroy();
      client = null;
      currentQRCode = null;
      logInfo("WhatsApp client destroyed");
    } catch (error) {
      logError("Error destroying client", error);
      client = null;
      currentQRCode = null;
    }
  }
}

/**
 * Gets the current QR code
 * @returns {string|null} Current QR code string or null
 */
export function getCurrentQRCode() {
  return currentQRCode;
}

/**
 * Registers a callback for QR code updates
 * @param {Function} callback - Callback function(qrCode, event, data)
 */
export function onQRCodeUpdate(callback) {
  if (typeof callback === "function") {
    qrCodeCallbacks.push(callback);
    // Immediately call with current QR if available
    if (currentQRCode) {
      callback(currentQRCode);
    }
  }
}

/**
 * Removes a QR code callback
 * @param {Function} callback - Callback function to remove
 */
export function removeQRCodeCallback(callback) {
  qrCodeCallbacks = qrCodeCallbacks.filter((cb) => cb !== callback);
}

/**
 * Logs out the WhatsApp client
 * Destroys the client and clears all authentication session files
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    logInfo("Logging out WhatsApp client...");

    // Destroy the client first to close the browser and release file locks
    await destroyClient();

    // Wait a bit for the browser to fully close and release file locks
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Clear authentication session files
    await clearAuthSession();

    logInfo("Logout completed successfully");
  } catch (error) {
    logError("Error during logout", error);
    throw error;
  }
}

/**
 * Checks if there's a new message and resets the flag
 * @returns {boolean} True if there's a new message, false otherwise
 */
export function checkAndResetNewMessage() {
  if (hasNewMessage) {
    hasNewMessage = false; // Reset the flag after checking
    return true;
  }
  return false;
}

/**
 * Gets the logged-in user's information
 * @returns {Promise<Object|null>} User info object with wid, phone, pushname, etc.
 */
export async function getUserInfo() {
  if (!client) {
    return null;
  }

  try {
    const ready = await isClientReady();
    if (!ready) {
      return null;
    }

    const info = client.info;
    if (!info) {
      return null;
    }

    // Extract phone number and user ID from wid
    let phoneNumber = null;
    let userId = null;

    if (info.wid) {
      if (typeof info.wid === "string") {
        // If wid is a string like "1234567890@c.us"
        userId = info.wid;
        phoneNumber = info.wid.split("@")[0];
      } else if (info.wid._serialized) {
        // If wid has _serialized property (most common case)
        userId = info.wid._serialized;
        phoneNumber = info.wid._serialized.split("@")[0];
      } else if (info.wid.user) {
        // If wid is an object with user property
        phoneNumber = info.wid.user;
        userId = `${info.wid.user}@${info.wid.server || "c.us"}`;
      } else {
        // Fallback: try to convert to string
        userId = String(info.wid);
        phoneNumber = String(info.wid).split("@")[0];
      }
    }

    return {
      userId: userId,
      phoneNumber: phoneNumber,
      pushname: info.pushname || null, // Display name
      platform: info.platform || null, // Platform info
      battery: info.battery !== undefined ? info.battery : null, // Battery info
      plugged: info.plugged || false, // Charging status
      me: info.me || null, // Additional user info
    };
  } catch (error) {
    logError("Error getting user info", error);
    return null;
  }
}
