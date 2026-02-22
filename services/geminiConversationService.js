/**
 * Gemini Conversation Service
 *
 * ניהול שיחות AI עם משתמשי WhatsApp
 * - ניהול היסטוריית שיחות לכל משתמש
 * - מעקב אחר שיחות AI פעילות
 * - טיפול בתגובות אוטומטיות
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as geminiService from "./geminiService.js";
import { getClient } from "./whatsappClient.js";
import { logInfo, logError, logWarn } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONVERSATIONS_FILE = path.join(__dirname, "../utils/gemini_conversations.json");
const ACTIVE_USERS_FILE = path.join(__dirname, "../utils/gemini_active_users.json");
const FINISHED_USERS_FILE = path.join(__dirname, "../utils/gemini_finished_users.json");
const AUTO_MESSAGES_FILE = path.join(__dirname, "../utils/ai_auto_messages.json");
const GEMINI_SETTINGS_FILE = path.join(__dirname, "../utils/gemini_settings.json");
const COMMENTSAI_PATH = path.join(__dirname, "../utils/COMMENTSAI.json");

let _commentsCache = null;
function loadCommentsAI() {
  if (_commentsCache) return _commentsCache;
  try {
    if (fs.existsSync(COMMENTSAI_PATH)) {
      _commentsCache = JSON.parse(fs.readFileSync(COMMENTSAI_PATH, "utf8"));
      return _commentsCache;
    }
  } catch (err) {
    logError("Error loading COMMENTSAI.json:", err);
  }
  _commentsCache = {};
  return _commentsCache;
}
function comment(key) {
  const comments = loadCommentsAI();
  return comments[key] != null ? String(comments[key]) : key;
}

// =============== SETTINGS MANAGEMENT ===============

function loadGeminiSettings() {
  try {
    if (fs.existsSync(GEMINI_SETTINGS_FILE)) {
      const data = fs.readFileSync(GEMINI_SETTINGS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    logError("❌ Error loading gemini settings:", err);
  }
  // ברירת מחדל - מצב ידני
  return {
    mode: "manual", // 'manual' או 'auto'
    autoModeConfig: {
      maxRecentChats: 5,
      maxMessageExchanges: 10,
    },
    updatedAt: null,
  };
}

function saveGeminiSettings(settings) {
  try {
    settings.updatedAt = new Date().toISOString();
    fs.writeFileSync(GEMINI_SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (err) {
    logError("❌ Error saving gemini settings:", err);
    return false;
  }
}

// =============== MESSAGE BATCHING SYSTEM ===============
// מערכת לאיסוף הודעות שנשלחות ברצף ועיבודן יחד
// הרעיון: אוספים הודעות, מחכים שהלקוח יסיים לכתוב, ורק אז שולחים ל-Gemini
// התנהגות: 5 שניות לכל הודעה, מקסימום 30 שניות, הודעות תוך כדי עיבוד לסבב הבא

const pendingMessages = new Map();
const processingLocks = new Map();
const DELAY_PER_MESSAGE_MS = 5000;
const MAX_WAIT_TIME_MS = 30000;
const PROCESSING_COOLDOWN_MS = 2000;

/**
 * מוסיף הודעה לתור ומחזיר Promise שמתממש כשההודעות מוכנות לעיבוד
 * @param {string} userId - מזהה המשתמש
 * @param {string} messageText - טקסט ההודעה
 * @returns {Promise<{shouldProcess: boolean, combinedMessages: string, messageCount: number, batchId?: string}>}
 */
function queueMessage(userId, messageText) {
  const existingPending = pendingMessages.get(userId);
  if (existingPending && existingPending.isProcessing) {
    logInfo(`⚠️ Message arrived while already processing for ${userId}, saving for next batch`);
    if (!existingPending.nextBatchMessages) {
      existingPending.nextBatchMessages = [];
    }
    existingPending.nextBatchMessages.push({ text: messageText, timestamp: new Date().toISOString() });
    logInfo(`📥 Saved message for next batch (${existingPending.nextBatchMessages.length} waiting)`);
    return Promise.resolve({ shouldProcess: false, combinedMessages: "", messageCount: 0, savedForNextBatch: true });
  }

  return new Promise((resolve) => {
    if (!pendingMessages.has(userId)) {
      pendingMessages.set(userId, {
        messages: [],
        timer: null,
        resolvers: [],
        isProcessing: false,
        nextBatchMessages: [],
        firstMessageTime: Date.now(),
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }

    const pending = pendingMessages.get(userId);
    pending.messages.push({ text: messageText, timestamp: new Date().toISOString() });
    pending.resolvers.push(resolve);

    const totalWaitTime = Math.min(pending.messages.length * DELAY_PER_MESSAGE_MS, MAX_WAIT_TIME_MS);
    const timeElapsed = Date.now() - pending.firstMessageTime;
    const remainingWaitTime = Math.max(totalWaitTime - timeElapsed, 1000);

    logInfo(`⏳ Queued message #${pending.messages.length} from ${userId}`);
    logInfo(`   📊 Total wait: ${totalWaitTime / 1000}s, remaining: ${(remainingWaitTime / 1000).toFixed(1)}s`);

    if (pending.timer) {
      clearTimeout(pending.timer);
      logInfo(`🔄 Timer updated for ${userId} - new message added`);
    }

    pending.timer = setTimeout(() => {
      logInfo(`⏰ Timer finished for ${userId} - processing batch of ${pending.messages.length} messages...`);

      const allMessages = [...pending.messages];
      const allResolvers = [...pending.resolvers];
      const savedNextBatch = [...(pending.nextBatchMessages || [])];
      const batchId = pending.batchId;

      pending.isProcessing = true;
      pending.nextBatchMessages = [];

      processingLocks.set(userId, { isProcessing: true, batchId, startTime: Date.now() });
      logInfo(`🔒 Set processing lock for ${userId} (batchId: ${batchId})`);

      let combinedText;
      if (allMessages.length === 1) {
        combinedText = allMessages[0].text;
      } else {
        combinedText = allMessages
          .map((m) => m.text.trim())
          .filter((text) => text.length > 0)
          .join(" ");
      }

      logInfo(`📦 Batched ${allMessages.length} message(s) from ${userId} into one (batchId: ${batchId})`);

      allResolvers.forEach((resolver, index) => {
        resolver({
          shouldProcess: index === 0,
          combinedMessages: combinedText,
          messageCount: allMessages.length,
          batchId,
        });
      });

      pendingMessages.delete(userId);

      setTimeout(() => {
        const lock = processingLocks.get(userId);
        if (lock && lock.batchId === batchId) {
          processingLocks.delete(userId);
          logInfo(`🔓 Released lock for ${userId} after cooldown`);
        }
      }, PROCESSING_COOLDOWN_MS);

      if (savedNextBatch.length > 0) {
        logInfo(`🔄 Starting new batch for ${savedNextBatch.length} queued messages`);
        savedNextBatch.forEach((msg) => {
          setTimeout(() => queueMessage(userId, msg.text), 100);
        });
      }
    }, remainingWaitTime);
  });
}

// =============== FILE MANAGEMENT ===============

function loadActiveUsers() {
  try {
    if (fs.existsSync(ACTIVE_USERS_FILE)) {
      const data = fs.readFileSync(ACTIVE_USERS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    logError("❌ Error loading active users:", err);
  }
  return {};
}

function saveActiveUsers(activeUsers) {
  try {
    fs.writeFileSync(ACTIVE_USERS_FILE, JSON.stringify(activeUsers, null, 2), "utf8");
  } catch (err) {
    logError("❌ Error saving active users:", err);
  }
}

function loadFinishedUsers() {
  try {
    if (fs.existsSync(FINISHED_USERS_FILE)) {
      const data = fs.readFileSync(FINISHED_USERS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    logError("❌ Error loading finished users:", err);
  }
  return {};
}

/** מנרמל userId לפורמט מספר בלבד למטרות השוואה */
function normalizeUserIdForLookup(userId) {
  if (!userId) return null;
  const match = String(userId).match(/^(\d+)@/);
  return match ? match[1] : userId;
}

/** בודק אם משתמש הושלם (לפי מספר טלפון) */
function isUserFinished(userId) {
  try {
    const finishedUsers = loadFinishedUsers();
    const normalizedId = normalizeUserIdForLookup(userId);
    if (!normalizedId) return false;
    for (const finishedUserId in finishedUsers) {
      if (normalizeUserIdForLookup(finishedUserId) === normalizedId) return true;
    }
    return false;
  } catch (err) {
    logError("❌ Error checking if user is finished:", err);
    return false;
  }
}

function saveFinishedUsers(finishedUsers) {
  try {
    fs.writeFileSync(FINISHED_USERS_FILE, JSON.stringify(finishedUsers, null, 2), "utf8");
  } catch (err) {
    logError("❌ Error saving finished users:", err);
  }
}

function loadAutoMessages() {
  try {
    if (fs.existsSync(AUTO_MESSAGES_FILE)) {
      const data = fs.readFileSync(AUTO_MESSAGES_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    logError("❌ Error loading auto messages:", err);
  }
  return { messages: [], updatedAt: null };
}

// =============== CONVERSATION MANAGEMENT ===============

/**
 * טעינת היסטוריית הצ'אט מ-WhatsApp
 * @param {string} userId - מזהה המשתמש
 * @param {number} limit - מספר ההודעות לטעון
 * @returns {Promise<Array>} - מערך של {role: 'user'|'model', text: string}
 */
async function loadChatHistoryFromWhatsApp(userId, limit = 40) {
  try {
    const client = getClient();
    if (!client) {
      logWarn(`⚠️ WhatsApp client not available, cannot load chat history for ${userId}`);
      return [];
    }

    const chat = await client.getChatById(userId);
    if (!chat) {
      logWarn(`⚠️ Chat not found for ${userId}`);
      return [];
    }

    const messages = await chat.fetchMessages({ limit: limit });
    logInfo(`📚 Loaded ${messages.length} messages from WhatsApp chat for ${userId}`);

    const history = [];
    for (const msg of messages) {
      const messageText = msg.body?.trim();
      if (!messageText || messageText.length === 0) {
        continue;
      }

      const role = msg.fromMe ? "model" : "user";
      history.push({ role, text: messageText });
    }

    logInfo(`✅ Built WhatsApp history: ${history.filter((h) => h.role === "user").length} user messages, ${history.filter((h) => h.role === "model").length} model messages`);
    return history;
  } catch (err) {
    logError(`❌ Error loading chat history from WhatsApp for ${userId}:`, err);
    return [];
  }
}

/**
 * התחלת שיחה אוטומטית (אנונימית - לא חושפת שם ל-Gemini)
 * @param {string} userId - מזהה המשתמש
 * @param {string} userName - שם (נשמר פנימית)
 * @param {string} userNumber - מספר טלפון
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function startConversationAnonymous(userId, userName, userNumber) {
  return startConversation(userId, userName || "משתמש", userNumber);
}

/**
 * התחלת שיחה חדשה עם משתמש
 * @param {string} userId - מזהה המשתמש
 * @param {string} userName - שם המשתמש
 * @param {string} userNumber - מספר טלפון
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export async function startConversation(userId, userName, userNumber) {
  try {
    const client = getClient();
    if (!client) {
      return { success: false, error: "WhatsApp client not available" };
    }

    const activeUsers = loadActiveUsers();
    if (activeUsers[userId]) {
      logInfo(`ℹ️ User ${userId} already has an active conversation, restarting...`);
      delete activeUsers[userId];
      saveActiveUsers(activeUsers);
    }

    logInfo(`📥 Loading existing chat history from WhatsApp for ${userId}...`);
    let history = await loadChatHistoryFromWhatsApp(userId, 40);

    const firstUserIndex = history.findIndex((msg) => msg.role === "user");
    if (firstUserIndex > 0) {
      logInfo(`⚠️ History starts with ${firstUserIndex} model messages, trimming to start from first user message`);
      history = history.slice(firstUserIndex);
    } else if (firstUserIndex === -1) {
      logInfo(`ℹ️ No user messages in existing chat history`);
      history = [];
    }

    logInfo(`📊 Loaded ${history.length} messages from WhatsApp as context for initial message`);

    const initialPrompt = `שלח הודעה ידידותית בעברית שממשיכה את השיחה. הודעה קצרה וחמה. אל תציין שם. אם יש היסטוריית שיחה - המשך אותה בצורה טבעית.`;

    let geminiResult;
    const context = { userId };
    if (history.length > 0) {
      logInfo(`🔄 Generating initial message with ${history.length} messages of context`);
      geminiResult = await geminiService.generateWithHistory(history, initialPrompt, { context });
    } else {
      logInfo(`🆕 Generating initial message without context (new conversation)`);
      geminiResult = await geminiService.generateText(initialPrompt, { context });
    }

    if (!geminiResult.success) {
      return { success: false, error: `GEMINI error: ${geminiResult.error}` };
    }

    const initialMessage = geminiResult.text;
    await client.sendMessage(userId, initialMessage, { sendSeen: false });

    activeUsers[userId] = {
      userId,
      userName,
      userNumber,
      startedAt: new Date().toISOString(),
    };
    saveActiveUsers(activeUsers);

    logInfo(`✅ Started GEMINI conversation with ${userName || userNumber} (${userId})`);
    return { success: true, message: initialMessage };
  } catch (err) {
    logError("❌ Error starting conversation:", err);
    return { success: false, error: err.message };
  }
}

/**
 * פרסור תשובת Gemini ל-function call (אינדקסים/help)
 * @param {string} response - תשובת Gemini
 * @returns {object|null} parsed או null
 */
function parseFunctionCallResponse(response) {
  try {
    return JSON.parse(response);
  } catch (e) {
    const jsonMatch = response.match(/\{[\s\S]*type[\s\S]*function[\s\S]*msg[\s\S]*\[[\s\S]*\][\s\S]*\}/i);
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[0].replace(/type\s*:\s*function/gi, '"type": "function"');
        return JSON.parse(jsonStr);
      } catch (e2) {}
    }
    const simpleMatch = response.match(/\{\s*type\s*:\s*(?:function|"function"|'function')\s*,\s*msg\s*:\s*\[([\d,\s]+)\]\s*\}/i);
    if (simpleMatch) {
      const indices = simpleMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));
      if (indices.length > 0) return { type: "function", msg: indices };
    }
    const flexibleMatch = response.match(/type\s*[:=]\s*(?:function|"function"|'function')\s*[,;]?\s*msg\s*[:=]\s*\[([\d,\s]+)\]/i);
    if (flexibleMatch) {
      const indices = flexibleMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));
      if (indices.length > 0) return { type: "function", msg: indices };
    }
    const helpMatch = response.match(/\{\s*type\s*:\s*(?:function|"function"|'function')\s*,\s*msg\s*:\s*["']?help["']?\s*\}/i);
    if (helpMatch) return { type: "function", msg: "help" };
  }
  return null;
}

/**
 * עיבוד הודעה נכנסת והחזרת תגובה דרך GEMINI
 * @param {string} userId - מזהה המשתמש
 * @param {string} messageText - טקסט ההודעה הנכנסת
 * @returns {Promise<{success: boolean, response?: string, error?: string, isManualTakeover?: boolean, isHelpCall?: boolean, isFinishCall?: boolean, isFunctionCall?: boolean, messages?: Array}>}
 */
export async function processIncomingMessage(userId, messageText) {
  try {
    const activeUsers = loadActiveUsers();
    if (!activeUsers[userId]) {
      return { success: false, error: "User not in active GEMINI conversation" };
    }

    logInfo(`📥 Loading chat history from WhatsApp for ${userId}...`);
    let history = await loadChatHistoryFromWhatsApp(userId, 40);

    if (history.length > 0 && history[history.length - 1].role === "user" && history[history.length - 1].text.trim() === messageText.trim()) {
      logInfo(`⚠️ Last message in history matches current message, removing duplicate`);
      history.pop();
    }

    const firstUserIndex = history.findIndex((msg) => msg.role === "user");
    if (firstUserIndex > 0) {
      logInfo(`⚠️ History starts with ${firstUserIndex} model messages, trimming`);
      history = history.slice(firstUserIndex);
    } else if (firstUserIndex === -1 && history.length > 0) {
      logInfo(`⚠️ No user messages in history, starting fresh`);
      history = [];
    }

    logInfo(`📊 Final history for Gemini: ${history.length} messages`);

    // זיהוי העברת שליטה ידנית ($ בהודעת model)
    const modelMessages = history.filter((msg) => msg.role === "model");
    const last5Model = modelMessages.slice(-5);
    if (last5Model.some((msg) => (msg.text || "").includes("$"))) {
      logInfo(`🔄 Manual takeover detected - stopping conversation`);
      return { success: true, isManualTakeover: true, userId };
    }

    const context = { userId };
    const geminiResult = await geminiService.generateWithHistory(history, messageText, { context });

    if (!geminiResult.success) {
      return { success: false, error: `GEMINI error: ${geminiResult.error}` };
    }

    const response = geminiResult.text.trim();
    logInfo(`🔍 GEMINI raw response: ${response.substring(0, 100)}...`);

    if (response.toLowerCase().trim() === "help") {
      logInfo(`🆘 GEMINI help request detected`);
      return { success: true, isHelpCall: true, userId };
    }

    if (response.toLowerCase().trim() === "finish") {
      logInfo(`✅ GEMINI finish request detected`);
      return { success: true, isFinishCall: true, userId };
    }

    const parsedResponse = parseFunctionCallResponse(response);
    if (parsedResponse && parsedResponse.type === "function") {
      if (typeof parsedResponse.msg === "string" && parsedResponse.msg.toLowerCase() === "help") {
        return { success: true, isHelpCall: true, userId };
      }
      if (Array.isArray(parsedResponse.msg)) {
        const autoMessages = loadAutoMessages();
        const messagesToSend = [];
        for (const index of parsedResponse.msg) {
          const m = autoMessages.messages.find((msg) => msg.index === index);
          if (m) messagesToSend.push(m);
        }
        if (messagesToSend.length > 0) {
          logInfo(`🔧 Function call: sending ${messagesToSend.length} predefined messages`);
          return { success: true, isFunctionCall: true, messages: messagesToSend };
        }
        return { success: true, response: comment("noReadyMessages") };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
    logInfo(`✅ GEMINI responded to ${userId}`);
    return { success: true, response };
  } catch (err) {
    logError("❌ Error processing incoming message:", err);
    return { success: false, error: err.message };
  }
}

/**
 * עיבוד הודעה נכנסת עם batching - אוסף הודעות רצופות ומעבד יחד
 * @param {string} userId - מזהה המשתמש
 * @param {string} messageText - טקסט ההודעה
 * @returns {Promise<{success: boolean, response?: string, error?: string, skipped?: boolean}>}
 */
export async function processIncomingMessageWithBatching(userId, messageText) {
  logInfo(`📥 [BATCH] New message from ${userId}`);

  const activeUsers = loadActiveUsers();
  if (!activeUsers[userId]) {
    return { success: false, error: "User not in active GEMINI conversation" };
  }

  const lock = processingLocks.get(userId);
  if (lock && lock.isProcessing) {
    logInfo(`🔒 [BATCH] Processing lock active for ${userId}, skipping`);
    return { success: true, skipped: true, reason: "processing_lock_active" };
  }

  logInfo(`⏳ [BATCH] Adding to queue, waiting for debounce...`);
  const queueResult = await queueMessage(userId, messageText);

  if (!queueResult.shouldProcess) {
    logInfo(`⏭️ [BATCH] Skipping - batch handled by another call`);
    return { success: true, skipped: true, batchId: queueResult.batchId };
  }

  const currentLock = processingLocks.get(userId);
  if (currentLock && currentLock.isProcessing && currentLock.batchId !== queueResult.batchId) {
    return { success: true, skipped: true, reason: "another_batch_processing" };
  }

  logInfo(`🚀 [BATCH] Timer finished - sending ${queueResult.messageCount} batched messages to Gemini`);
  const result = await processIncomingMessage(userId, queueResult.combinedMessages);
  logInfo(`✅ [BATCH] Gemini processing complete for ${userId}`);
  return result;
}

/**
 * עצירת שיחה עם משתמש
 * @param {string} userId - מזהה המשתמש
 * @param {boolean} markAsFinished - האם לסמן את המשתמש כהושלם
 * @returns {boolean}
 */
export function stopConversation(userId, markAsFinished = false) {
  try {
    const activeUsers = loadActiveUsers();
    if (activeUsers[userId]) {
      const userInfo = activeUsers[userId];
      const userName = userInfo.userName || null;
      const userNumber = userInfo.userNumber || null;

      delete activeUsers[userId];
      saveActiveUsers(activeUsers);
      logInfo(`✅ Stopped GEMINI conversation with ${userId}`);

      if (markAsFinished) {
        const finishedUsers = loadFinishedUsers();
        finishedUsers[userId] = {
          userId,
          userName,
          userNumber,
          finishedAt: new Date().toISOString(),
        };
        saveFinishedUsers(finishedUsers);
      }

      return true;
    }
    return false;
  } catch (err) {
    logError("❌ Error stopping conversation:", err);
    return false;
  }
}

/**
 * בדיקה אם משתמש פעיל בשיחה
 * @param {string} userId - מזהה המשתמש
 * @returns {boolean}
 */
export function isUserActive(userId) {
  const activeUsers = loadActiveUsers();
  return !!activeUsers[userId];
}

/**
 * קבלת רשימת כל המשתמשים הפעילים
 * @returns {Array}
 */
export function getActiveUsers() {
  const activeUsers = loadActiveUsers();
  return Object.values(activeUsers);
}

/**
 * קבלת המשתמשים שהושלמו
 * @returns {Object}
 */
export function getFinishedUsers() {
  return loadFinishedUsers();
}

/**
 * מחיקת משתמש מרשימת המשתמשים שהושלמו (תמיכה בחיפוש לפי מספר)
 * @param {string} userId - מזהה המשתמש
 * @returns {boolean}
 */
export function deleteFinishedUser(userId) {
  try {
    const finishedUsers = loadFinishedUsers();
    const normalizedId = normalizeUserIdForLookup(userId);
    let foundKey = finishedUsers[userId] ? userId : null;
    if (!foundKey && normalizedId) {
      for (const key in finishedUsers) {
        if (normalizeUserIdForLookup(key) === normalizedId) {
          foundKey = key;
          break;
        }
      }
    }
    if (foundKey) {
      delete finishedUsers[foundKey];
      saveFinishedUsers(finishedUsers);
      logInfo(`✅ Deleted finished user ${foundKey}`);
      return true;
    }
    return false;
  } catch (err) {
    logError("❌ Error deleting finished user:", err);
    return false;
  }
}

// =============== MODE MANAGEMENT ===============

export function getGeminiSettings() {
  return loadGeminiSettings();
}

export function getCurrentMode() {
  const settings = loadGeminiSettings();
  return settings.mode || "manual";
}

export function setManualMode() {
  const settings = loadGeminiSettings();
  settings.mode = "manual";

  if (saveGeminiSettings(settings)) {
    stopAutoModeInterval();
    logInfo("✅ Switched to MANUAL mode");
    return { success: true, mode: "manual" };
  }
  return { success: false, error: "Failed to save settings" };
}

export async function setAutoMode() {
  const settings = loadGeminiSettings();
  settings.mode = "auto";

  if (!saveGeminiSettings(settings)) {
    return { success: false, error: "Failed to save settings" };
  }

  const result = await activateAutoModeChats();
  startAutoModeInterval();

  logInfo(`✅ Switched to AUTO mode - activated ${result.activatedCount} users, interval started`);
  return {
    success: true,
    mode: "auto",
    activatedUsers: result.activatedUsers,
    activatedCount: result.activatedCount,
  };
}

async function activateAutoModeChats() {
  try {
    const client = getClient();
    if (!client) {
      logError("❌ WhatsApp client not available for auto mode");
      return { activatedUsers: [], activatedCount: 0 };
    }

    const settings = loadGeminiSettings();
    const maxRecentChats = settings.autoModeConfig?.maxRecentChats || 5;
    const maxMessageExchanges = settings.autoModeConfig?.maxMessageExchanges || 10;

    logInfo(`🔍 Auto mode: Checking last ${maxRecentChats} chats with less than ${maxMessageExchanges} messages...`);

    const chats = await client.getChats();
    const personalChats = chats.filter((chat) => !chat.isGroup);
    const recentChats = personalChats.slice(0, maxRecentChats);

    logInfo(`📋 Found ${recentChats.length} personal chats to check`);

    const activatedUsers = [];

    for (const chat of recentChats) {
      const chatId = chat.id._serialized;
      const chatName = chat.name || chatId.split("@")[0];

      let messageCount = 0;
      try {
        const messages = await chat.fetchMessages({ limit: 20 });
        messageCount = messages.length;
        logInfo(`📊 Chat "${chatName}" (${chatId}): ${messageCount} messages`);
      } catch (fetchErr) {
        logWarn(`⚠️ Could not fetch messages for ${chatId}: ${fetchErr.message}`);
        continue;
      }

      if (isUserActive(chatId)) {
        logInfo(`⏭️ ALREADY ACTIVE: "${chatName}" - skipping`);
        continue;
      }

      if (isUserFinished(chatId)) {
        logInfo(`✅ FINISHED: "${chatName}" - skipping (user already finished)`);
        continue;
      }

      if (messageCount < maxMessageExchanges) {
        let userName = chat.name || "";
        let userNumber = chatId.split("@")[0];

        try {
          const contact = await chat.getContact();
          userName = contact.pushname || contact.name || userName;
          userNumber = contact.number || userNumber;
        } catch (e) {
          // נמשיך עם מה שיש לנו
        }

        const nameToCheck = (userName || chatName || "").toLowerCase();
        if (nameToCheck.includes("אמא") || nameToCheck.includes("תלמיד")) {
          logInfo(`🚫 BLOCKED: "${userName || chatName}" - contains "אמא" or "תלמיד", skipping`);
          continue;
        }

        const result = await startConversationAnonymous(chatId, userName, userNumber);

        if (result.success) {
          activatedUsers.push({
            userId: chatId,
            userName: userName || userNumber,
            userNumber,
            messageCount,
          });
          logInfo(`✅ NEW USER ADDED: "${userName || userNumber}" - ${messageCount} messages`);
        }
      }
    }

    logInfo(`\n✅ Auto mode complete: ${activatedUsers.length} users activated`);
    return { activatedUsers, activatedCount: activatedUsers.length };
  } catch (err) {
    logError("❌ Error activating auto mode chats:", err);
    return { activatedUsers: [], activatedCount: 0 };
  }
}

export async function refreshAutoMode() {
  const settings = loadGeminiSettings();
  if (settings.mode !== "auto") {
    return { success: false, error: "Not in auto mode" };
  }

  const result = await activateAutoModeChats();
  return {
    success: true,
    activatedUsers: result.activatedUsers,
    activatedCount: result.activatedCount,
  };
}

// =============== AUTO MODE INTERVAL ===============

let autoModeIntervalId = null;
const AUTO_MODE_CHECK_INTERVAL_MS = 40000; // 40 שניות

function startAutoModeInterval() {
  stopAutoModeInterval();

  logInfo(`⏰ Starting auto mode interval - checking every ${AUTO_MODE_CHECK_INTERVAL_MS / 1000} seconds`);

  autoModeIntervalId = setInterval(async () => {
    const settings = loadGeminiSettings();

    if (settings.mode !== "auto") {
      logInfo("⏸️ Auto mode interval: Not in auto mode, skipping check");
      return;
    }

    logInfo("🔄 Auto mode interval: Checking for new chats...");

    try {
      await activateAutoModeChats();
    } catch (err) {
      logError("❌ Auto mode interval error:", err);
    }
  }, AUTO_MODE_CHECK_INTERVAL_MS);
}

function stopAutoModeInterval() {
  if (autoModeIntervalId) {
    clearInterval(autoModeIntervalId);
    autoModeIntervalId = null;
    logInfo("⏹️ Auto mode interval stopped");
  }
}

export function isAutoModeIntervalRunning() {
  return autoModeIntervalId !== null;
}

// התחל את ה-interval אוטומטית כשהמודול נטען
setTimeout(() => {
  const settings = loadGeminiSettings();
  if (settings.mode === "auto") {
    logInfo("🚀 Auto mode is active on startup, starting interval...");
    startAutoModeInterval();
  }
}, 5000);
