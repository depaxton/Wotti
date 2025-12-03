// WhatsApp client service
// Handles client initialization, QR code display, and event listeners

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

let client = null;
let currentQRCode = null;
let qrCodeCallbacks = [];
let isReinitializing = false;
let hasNewMessage = false; // Flag to track if a new message was received
let loadingCheckInterval = null; // משתנה גלובלי לניהול הלופ
let sleepWakeCheckInterval = null; // בדיקה תקופתית לזיהוי התעוררות ממצב שינה
let isRestarting = false; // flag למניעת קריאות מרובות ל-restart
let lastCheckTime = Date.now(); // זמן הבדיקה האחרונה - לזיהוי קפיצות זמן (שינה/התעוררות)

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
        headless: true, // Set to false to see browser (for debugging)
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
 * Starts monitoring the WhatsApp page for "בטעינה" (loading) text
 * Updates status to "loading" when detected
 * @param {Client} clientInstance - WhatsApp client instance
 */
async function startLoadingDetection(clientInstance) {
  // עצור לופ קודם אם קיים
  if (loadingCheckInterval) {
    clearInterval(loadingCheckInterval);
    loadingCheckInterval = null;
  }

  try {
    // המתן קצת שהדף יהיה מוכן
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // קבל את דף Puppeteer מה-client
    let page = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!page && attempts < maxAttempts) {
      try {
        if (clientInstance.pupPage) {
          page = clientInstance.pupPage;
        } else if (clientInstance.pupBrowser) {
          const pages = await clientInstance.pupBrowser.pages();
          page = pages[0];
        } else if (clientInstance._pupPage) {
          page = clientInstance._pupPage;
        }

        if (page && !page.isClosed()) {
          break;
        } else {
          page = null;
        }
      } catch (error) {
        // המשך לנסות
      }

      if (!page) {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    if (!page) {
      logWarn("Could not access Puppeteer page for loading detection after multiple attempts");
      return;
    }

    // לופ כל שנייה לבדיקת טקסט "בטעינה"
    loadingCheckInterval = setInterval(async () => {
      try {
        // בדוק אם הדף עדיין זמין
        if (page.isClosed()) {
          clearInterval(loadingCheckInterval);
          loadingCheckInterval = null;
          return;
        }

        // בדוק אם הטקסט "בטעינה" קיים בדף
        const hasLoadingText = await page.evaluate(() => {
          // חיפוש בכל האלמנטים בדף
          const allElements = document.querySelectorAll("*");

          for (const element of allElements) {
            const text = element.innerText || element.textContent || "";
            if (text.includes("בטעינה")) {
              return true;
            }
          }

          return false;
        });

        if (hasLoadingText) {
          logInfo("Detected 'בטעינה' (loading) text on WhatsApp page");
          // עדכן סטטוס ל-loading
          qrCodeCallbacks.forEach((callback) => callback(null, "loading"));
          // עצור את הלופ - מצאנו את הטקסט
          clearInterval(loadingCheckInterval);
          loadingCheckInterval = null;
        }
      } catch (error) {
        // הדף אולי נסגר או נווט למקום אחר
        logWarn("Error checking for loading text:", error.message);
        clearInterval(loadingCheckInterval);
        loadingCheckInterval = null;
      }
    }, 1000); // כל שנייה (1000ms)
  } catch (error) {
    logWarn("Could not start loading detection:", error.message);
  }
}

/**
 * Stops the loading detection loop
 */
function stopLoadingDetection() {
  if (loadingCheckInterval) {
    clearInterval(loadingCheckInterval);
    loadingCheckInterval = null;
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

    // התחל לבדוק מיד אחרי QR code
    startLoadingDetection(clientInstance);
  });

  // Authentication event
  clientInstance.on("authenticated", async () => {
    logInfo("Client authenticated successfully");
    currentQRCode = null; // Clear QR code after authentication
    qrCodeCallbacks.forEach((callback) => callback(null, "authenticated"));

    // הלופ כבר רץ מ-QR, לא צריך להתחיל שוב
  });

  // Ready event
  clientInstance.on("ready", () => {
    logInfo("WhatsApp client is ready!");
    currentQRCode = null; // Clear QR code when ready
    qrCodeCallbacks.forEach((callback) => callback(null, "ready"));

    // עצור את הלופ כשהוא מוכן
    stopLoadingDetection();

    // התחל בדיקה תקופתית לזיהוי שינה/התעוררות
    startSleepWakeCheck();
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
    // לא עושים כלום כאן - רק הבדיקה התקופתית תטפל ב-Target closed
    logError("Error checking client state", error);
    return false;
  }
}

/**
 * Checks if the computer was asleep (by detecting time jump)
 * @returns {boolean} True if time jump detected (computer was asleep), false otherwise
 */
function detectWakeFromSleep() {
  const currentTime = Date.now();
  const timeSinceLastCheck = currentTime - lastCheckTime;

  // אם עבר יותר מ-6 שניות מאז הבדיקה האחרונה,
  // זה אומר שהמחשב היה בשינה והתעורר
  // (בדיקה רגילה היא כל 10 שניות, אבל אם עברו רק 6+ זה כבר יכול להיות שינה)
  const sleepThreshold = 20000; // 6 שניות

  // שינוי: >= במקום > כדי לזהות גם 6 שניות בדיוק
  if (timeSinceLastCheck >= sleepThreshold) {
    logInfo(`Time jump detected: ${Math.round(timeSinceLastCheck / 1000)} seconds since last check. Computer likely woke from sleep.`);
    // עדכן את lastCheckTime גם כשמזהה שינה, כדי למנוע זיהוי כפול
    lastCheckTime = currentTime;
    return true;
  }

  lastCheckTime = currentTime;
  return false;
}

/**
 * Runs the VBS script to restart the application after sleep/wake
 * The VBS script will kill all processes (Node.js, Chrome/Puppeteer) and restart npm start
 */
async function runRestartVBS() {
  return new Promise((resolve, reject) => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const projectRoot = path.resolve(__dirname, "..");
      const vbsPath = path.join(projectRoot, "restart-after-wake.vbs");

      logInfo(`Running VBS restart script: ${vbsPath}`);

      // Run VBS script using cscript (Windows Script Host)
      // /nologo - don't show logo
      // /b - batch mode (no user interaction)
      exec(`cscript //nologo //b "${vbsPath}"`, (error, stdout, stderr) => {
        if (error) {
          logError("Error running VBS restart script", error);
          reject(error);
          return;
        }

        if (stdout) {
          logInfo(`VBS script output: ${stdout}`);
        }

        if (stderr) {
          logWarn(`VBS script stderr: ${stderr}`);
        }

        logInfo("VBS restart script executed successfully");
        resolve();
      });
    } catch (error) {
      logError("Failed to run VBS restart script", error);
      reject(error);
    }
  });
}

/**
 * Starts periodic check for wake from sleep detection
 * Checks every 10 seconds if the computer woke from sleep (by detecting time jump)
 * When wake is detected, runs the restart-after-wake.vbs script
 */
export function startSleepWakeCheck() {
  // עצור בדיקה קודמת אם קיימת
  if (sleepWakeCheckInterval) {
    clearInterval(sleepWakeCheckInterval);
    sleepWakeCheckInterval = null;
  }

  // אתחל את זמן הבדיקה האחרונה
  lastCheckTime = Date.now();
  logInfo("Sleep/wake check started - will check every 10 seconds");

  // בדיקה כל 10 שניות
  sleepWakeCheckInterval = setInterval(async () => {
    if (isReinitializing || isRestarting) {
      // לוג רק אם זה לא הפעם הראשונה
      if (isRestarting) {
        logInfo("Sleep check skipped - restart already in progress");
      }
      return; // כבר בתהליך
    }

    try {
      // בדוק אם המחשב התעורר משינה (על ידי זיהוי קפיצה בזמן)
      const wokeFromSleep = detectWakeFromSleep();

      if (wokeFromSleep && !isRestarting) {
        // המחשב התעורר משינה - הרץ את ה-VBS script
        logInfo("Detected computer wake from sleep! Running restart-after-wake.vbs...");
        isRestarting = true;

        // הפעל VBS script שיסגור הכל ויריץ npm start מחדש
        setTimeout(async () => {
          try {
            await runRestartVBS();
            // VBS script יריץ את npm start, אז התהליך הנוכחי ייסגר
            // המתן קצת ואז צא מהתהליך
            setTimeout(() => {
              logInfo("Exiting current process - VBS script will restart the application");
              process.exit(0);
            }, 3000);
          } catch (restartError) {
            logError("Failed to run VBS restart script after wake up", restartError);
            isRestarting = false; // אפשר ניסיון נוסף בעתיד
            lastCheckTime = Date.now(); // איפוס זמן הבדיקה
          }
        }, 2000);
      }
    } catch (error) {
      logError("Error in sleep/wake check", error);
      // נמשיך לבדוק גם אם יש שגיאה
    }
  }, 10000); // כל 10 שניות
}

/**
 * Stops the sleep/wake check
 */
export function stopSleepWakeCheck() {
  if (sleepWakeCheckInterval) {
    clearInterval(sleepWakeCheckInterval);
    sleepWakeCheckInterval = null;
  }
}

/**
 * Destroys the WhatsApp client instance
 * This properly closes the browser and cleans up resources
 */
export async function destroyClient() {
  // עצור בדיקת שינה/התעוררות
  stopSleepWakeCheck();

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
