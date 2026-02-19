// API routes
// Defines all API endpoints and maps them to their controllers

import express from "express";
import { getQr, getStatus, getContacts, getContactsFromJSON, getUserInfoController, logoutController, checkNewMessage } from "../controllers/whatsappController.js";
import { getSettings, updateSettings, getReminderTemplate, updateReminderTemplate } from "../controllers/settingsController.js";
import { getUserReminders, saveUserReminders, patchUserReminder, getAllUsersController, sendReminderManually, getAllRemindersController, updateUserName } from "../controllers/userController.js";
import { getMessages, sendMessage, getMessageMedia, deleteMessage, getChatStatus, searchMessages } from "../controllers/chatController.js";
import * as geminiController from "../controllers/geminiController.js";
import * as marketingDistribution from "../controllers/marketingDistributionController.js";
import { getBusinessHours, postBusinessHours } from "../controllers/businessHoursController.js";
import * as serviceCategoriesController from "../controllers/serviceCategoriesController.js";
import {
  getAuthUrlController,
  oauthCallbackController,
  getStatusController,
  disconnectController
} from "../controllers/googleCalendarController.js";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const router = express.Router();

/**
 * Wraps async route handlers so rejected promises are caught and returned as 500.
 * Keeps route handlers DRY and ensures no unhandled rejections.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      res.status(500).json({ error: err?.message ?? "Internal server error" });
    });
  };
}

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
router.patch("/users/:phone/reminders/:id", patchUserReminder);
router.post("/users/:phone/send-reminder", sendReminderManually);
router.put("/users/:phone/name", updateUserName);
router.get("/reminders/all", getAllRemindersController);

// Version API endpoint
router.get("/version", asyncHandler(async (req, res) => {
  const packageJsonPath = path.join(PROJECT_ROOT, "package.json");
  const packageJson = await fs.readJson(packageJsonPath);
  res.json({ version: packageJson.version || "unknown" });
}));

// Gemini AI API endpoints
router.post("/gemini/generate", geminiController.generateText);
router.post("/gemini/chat", geminiController.chat);
router.get("/gemini/api-key", geminiController.getApiKeyEndpoint);
router.post("/gemini/api-key", geminiController.saveApiKey);
router.delete("/gemini/api-key", geminiController.removeApiKey);
router.get("/gemini/status", geminiController.getStatus);
router.get("/gemini/models", geminiController.getModels);
router.post("/gemini/start-conversation", geminiController.startConversation);
router.post("/gemini/stop-conversation", geminiController.stopConversation);
router.get("/gemini/active-conversations", geminiController.getActiveConversations);
router.post("/gemini/instructions", geminiController.saveInstructions);
router.get("/gemini/instructions", geminiController.getInstructions);
router.get("/gemini/mode", geminiController.getMode);
router.post("/gemini/mode/manual", geminiController.setManualMode);
router.post("/gemini/mode/auto", geminiController.setAutoMode);
router.post("/gemini/mode/refresh", geminiController.refreshAutoMode);
router.get("/gemini/finished-users", geminiController.getFinishedUsers);
router.delete("/gemini/finished-users/:userId", geminiController.deleteFinishedUser);
router.get("/gemini/auto-messages", geminiController.getAutoMessages);
router.post("/gemini/auto-messages", geminiController.saveAutoMessage);
router.put("/gemini/auto-messages/:id", geminiController.updateAutoMessage);
router.delete("/gemini/auto-messages/:id", geminiController.deleteAutoMessage);

// Marketing distribution (הפצה שיווקית)
router.get("/marketing-distribution/messages", marketingDistribution.getMessagesController);
router.post("/marketing-distribution/messages", marketingDistribution.postMessageController);
router.put("/marketing-distribution/messages/:id", marketingDistribution.putMessageController);
router.delete("/marketing-distribution/messages/:id", marketingDistribution.deleteMessageController);
router.get("/marketing-distribution/to-send", marketingDistribution.getToSendController);
router.post("/marketing-distribution/to-send", marketingDistribution.postToSendController);
router.delete("/marketing-distribution/to-send/:phone", marketingDistribution.deleteFromToSendController);
router.get("/marketing-distribution/sent", marketingDistribution.getSentController);
router.get("/marketing-distribution/settings", marketingDistribution.getSettingsController);
router.post("/marketing-distribution/settings", marketingDistribution.postSettingsController);
router.get("/marketing-distribution/status", marketingDistribution.getStatusController);
router.post("/marketing-distribution/send-one", marketingDistribution.sendOneController);

// Business hours (שעות פעילות עסק)
router.get("/business-hours", getBusinessHours);
router.post("/business-hours", postBusinessHours);

// Service categories (קטגוריות שירות לקביעת תורים)
router.get("/service-categories", serviceCategoriesController.getCategories);
router.post("/service-categories", serviceCategoriesController.postCategory);
router.put("/service-categories/:id", serviceCategoriesController.putCategory);
router.delete("/service-categories/:id", serviceCategoriesController.deleteCategoryController);

// Google Calendar (ממשקות יומן גוגל)
router.get("/google-calendar/auth-url", getAuthUrlController);
router.get("/google-calendar/callback", oauthCallbackController);
router.get("/google-calendar/status", getStatusController);
router.post("/google-calendar/disconnect", disconnectController);

export default router;
