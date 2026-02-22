// Main entry point for WhatsApp integration
// Initializes services and starts the server

import app from "./app.js";
import { PORT } from "./config/serverConfig.js";
import { initializeClient, destroyClient, isClientReady } from "./services/whatsappClient.js";
import { initStateListener } from "./services/stateService.js";
import { startScheduler, stopScheduler, initializeReminderStatuses } from "./services/reminderScheduler.js";
import { startMarketingDistributionScheduler, stopMarketingDistributionScheduler } from "./services/marketingDistributionScheduler.js";
import { initializeSystemTray, destroySystemTray } from "./services/systemTray.js";
import { logInfo, logError, logWarn } from "./utils/logger.js";
import { initGeminiWhatsAppBridge } from "./services/geminiWhatsAppBridge.js";
import { initMarketingUnsubscribeHandler } from "./services/marketingUnsubscribeHandler.js";
import { cleanupAllProcesses } from "./utils/processCleanup.js";
// הגדר שם תהליך (יופיע ב-Task Manager)
if (process.env.PROCESS_NAME) {
  try {
    process.title = process.env.PROCESS_NAME;
  } catch (error) {
    // אם לא ניתן לשנות, זה לא קריטי
  }
} else {
  // ברירת מחדל
  try {
    process.title = "WOTTI";
  } catch (error) {
    // אם לא ניתן לשנות, זה לא קריטי
  }
}

/**
 * Main function to initialize and run the WhatsApp integration
 */
async function main() {
  let server = null;

  try {
    logInfo("Starting WhatsApp integration server...");

    // Start Express server FIRST (non-blocking)
    // This allows the frontend to be available immediately
    server = app.listen(PORT, () => {
      logInfo(`Server running on http://localhost:${PORT}`);
      logInfo(`Frontend available at http://localhost:${PORT}`);
      logInfo(`QR code API available at http://localhost:${PORT}/api/qr`);
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\n"); // New line for readability
      logInfo("Received termination signal. Shutting down...");

      // Stop schedulers first
      stopScheduler();
      stopMarketingDistributionScheduler();

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

      // Destroy WhatsApp client (closes the browser)
      await destroyClient();

      // Destroy system tray icon
      await destroySystemTray();

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Comprehensive cleanup of all processes and ports
      await cleanupAllProcesses();

      logInfo("Cleanup complete. Exiting.");
      process.exit(0);
    };

    // Initialize system tray (Windows only)
    // Pass shutdown function to tray so it can trigger graceful shutdown
    initializeSystemTray(shutdown).catch((error) => {
      logError("Failed to initialize system tray", error);
      // Continue anyway - application can run without tray
    });

    // Initialize WhatsApp client ASYNCHRONOUSLY in the background (non-blocking)
    // This allows Puppeteer to load without blocking the server
    initializeClientInBackground();

    // Listen for termination signals
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logError("Failed to run WhatsApp integration", error);
    process.exit(1);
  }
}

/**
 * Initialize WhatsApp client in the background without blocking server startup
 */
async function initializeClientInBackground() {
  try {
    logInfo("Initializing WhatsApp client in the background...");
    
    // Initialize the WhatsApp client (this will take time with Puppeteer)
    await initializeClient();

    // Initialize state listener for client events
    initStateListener();

    // Initialize Gemini-WhatsApp bridge - גשר אוניברסלי לכל שיחות AI
    initGeminiWhatsAppBridge();

    // When user sends "הסרה", add to marketing "never send" list
    initMarketingUnsubscribeHandler();

    // Initialize reminder statuses (ensures all reminders have proper status fields)
    await initializeReminderStatuses();

    // Wait for WhatsApp client to be ready, then start scheduler
    const waitForClientAndStartScheduler = async () => {
      const maxAttempts = 60; // Wait up to 60 seconds
      let attempts = 0;
      
      const checkClient = async () => {
        try {
          const ready = await isClientReady();
          if (ready) {
            logInfo("WhatsApp client is ready. Starting reminder scheduler...");
            startScheduler();
            startMarketingDistributionScheduler();
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              // Check again in 1 second
              setTimeout(checkClient, 1000);
            } else {
              logError("WhatsApp client did not become ready within timeout. Scheduler will not start.");
              logError("Please scan QR code and restart the server.");
            }
          }
        } catch (error) {
          logError("Error checking client readiness:", error);
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkClient, 1000);
          }
        }
      };
      
      checkClient();
    };
    
    // Start checking for client readiness (don't await - non-blocking)
    waitForClientAndStartScheduler();
  } catch (error) {
    logError("Failed to initialize WhatsApp client in background:", error);
    // Don't exit - server should continue running even if client fails
  }
}

// Run the main function
main();
