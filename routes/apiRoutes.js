// API routes
// Defines all API endpoints and maps them to their controllers

import express from "express";
import { getQr, getStatus, getContacts, getContactsFromJSON, getUserInfoController, logoutController, checkNewMessage } from "../controllers/whatsappController.js";
import { getSettings, updateSettings, getReminderTemplate, updateReminderTemplate } from "../controllers/settingsController.js";
import { getUserReminders, saveUserReminders, getAllUsersController, sendReminderManually, getAllRemindersController, updateUserName } from "../controllers/userController.js";
import { getMessages, sendMessage, getMessageMedia, deleteMessage, getChatStatus, searchMessages } from "../controllers/chatController.js";
import { manualUpdateCheck, manualUpdateInstall, getUpdateStatus } from "../services/updateService.js";
import { restartApplication } from "../services/restartService.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const router = express.Router();

// WhatsApp API endpoints
router.get("/qr", getQr);
router.get("/status", getStatus);
router.get("/contacts", getContacts);
router.get("/contacts/json", getContactsFromJSON);
router.get("/user/info", getUserInfoController);
router.get("/messages/new", checkNewMessage);
router.post("/logout", logoutController);

// Chat API endpoints
router.get("/chat/:chatId/messages", getMessages);
router.post("/chat/send", sendMessage);
router.get("/chat/:messageId/media", getMessageMedia);
router.delete("/chat/:messageId", deleteMessage);
router.get("/chat/:chatId/status", getChatStatus);
router.get("/chat/:chatId/search", searchMessages);

// Settings API endpoints
router.get("/settings", getSettings);
router.post("/settings", updateSettings);
router.get("/settings/reminder-template", getReminderTemplate);
router.post("/settings/reminder-template", updateReminderTemplate);

// User API endpoints
router.get("/users", getAllUsersController);
router.get("/users/:phone/reminders", getUserReminders);
router.post("/users/:phone/reminders", saveUserReminders);
router.post("/users/:phone/send-reminder", sendReminderManually);
router.put("/users/:phone/name", updateUserName);
router.get("/reminders/all", getAllRemindersController);

// Version API endpoint
router.get("/version", async (req, res) => {
  try {
    const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
    const packageJson = await fs.readJson(packageJsonPath);
    res.json({ version: packageJson.version || "unknown" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update API endpoints
router.get("/update/status", async (req, res) => {
  try {
    const status = await getUpdateStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/update/check", async (req, res) => {
  try {
    const updateInfo = await manualUpdateCheck();
    if (updateInfo) {
      res.json({ updateAvailable: true, updateInfo });
    } else {
      res.json({ updateAvailable: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/update/install", async (req, res) => {
  try {
    // Get update info first
    const updateInfo = await manualUpdateCheck();
    if (!updateInfo) {
      return res.status(400).json({ error: "No update available" });
    }
    
    // Start update in background (don't wait for completion)
    manualUpdateInstall(updateInfo).catch((error) => {
      console.error("Update installation failed:", error);
    });
    
    res.json({ 
      message: "Update installation started",
      updateInfo 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restart API endpoint
router.post("/restart", async (req, res) => {
  try {
    // Send response immediately before restart
    res.json({ 
      message: "Restart initiated",
      status: "restarting"
    });

    // Start restart in background (don't wait for completion)
    // Small delay to ensure response is sent
    setTimeout(async () => {
      try {
        await restartApplication();
      } catch (error) {
        console.error("Restart failed:", error);
      }
    }, 500);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
