/**
 * Gemini WhatsApp Bridge
 *
 * דף ייעודי אוניברסלי - גשר בין WhatsApp ל-Gemini AI
 * כל קוד עתידי שרוצה להשתמש בשיחה עם GEMINI יעבור דרך מודול זה.
 *
 * תפקידים:
 * - האזנה להודעות נכנסות מ-WhatsApp
 * - בדיקה אם המשתמש בשיחה פעילה עם AI
 * - עיבוד הודעות דרך Gemini ושילוח תשובות חזרה
 * - נקודת כניסה מרכזית לכל מימוש עתידי של שיחת AI
 */

import { getClient, registerIncomingMessageHandler } from './whatsappClient.js';
import * as geminiConversationService from './geminiConversationService.js';
import { processAiResponse } from './aiCommandMiddleware.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

// =============== NORMALIZATION ===============

/**
 * מנרמל מזהה משתמש מ-WhatsApp לפורמט אחיד
 * WhatsApp משתמש ב-@c.us או @s.whatsapp.net - מנרמל ל-@s.whatsapp.net
 * @param {string} rawId - מזהה גולמי (למשל 972501234567@c.us)
 * @returns {string} מזהה מנורמל
 */
function normalizeUserId(rawId) {
  if (!rawId || typeof rawId !== 'string') return '';
  const trimmed = rawId.trim();
  if (trimmed.endsWith('@c.us')) {
    return trimmed.replace(/@c\.us$/, '@s.whatsapp.net');
  }
  return trimmed;
}

// =============== CORE HANDLER ===============

/**
 * מטפל בהודעה נכנסת מ-WhatsApp - נקודת הכניסה האוניברסלית
 * כל מימוש עתידי של שיחת AI צריך לעבור כאן או להשתמש ב-handleIncomingMessage
 *
 * @param {object} message - אובייקט הודעה מ-whatsapp-web.js
 * @param {string} message.from - מזהה השולח
 * @param {string} message.body - תוכן ההודעה
 * @param {boolean} message.fromMe - האם ההודעה מאיתנו
 * @returns {Promise<{handled: boolean, error?: string}>} האם הטופלנו בהודעה (AI ענה)
 */
export async function handleIncomingMessage(message) {
  if (!message || message.fromMe) {
    return { handled: false };
  }

  const rawFrom = message.from;
  const messageText = (message.body || '').trim();
  if (!messageText) {
    return { handled: false };
  }

  const normalizedFrom = normalizeUserId(rawFrom);
  const canonicalUserId = geminiConversationService.isUserActive?.(rawFrom)
    ? rawFrom
    : geminiConversationService.isUserActive?.(normalizedFrom)
      ? normalizedFrom
      : null;
  if (!canonicalUserId) {
    return { handled: false };
  }

  logInfo(`🤖 [Gemini Bridge] Processing message from active user ${rawFrom}`);

  try {
    const result = await geminiConversationService.processIncomingMessageWithBatching(canonicalUserId, messageText);

    if (!result.success) {
      logWarn(`⚠️ [Gemini Bridge] processIncomingMessageWithBatching failed: ${result.error}`);
      return { handled: true, error: result.error };
    }

    if (result.skipped) {
      return { handled: true };
    }

    const client = getClient();
    if (!client) {
      logError('❌ [Gemini Bridge] WhatsApp client not available');
      return { handled: true, error: 'Client not available' };
    }

    if (result.isManualTakeover) {
      geminiConversationService.stopConversation(canonicalUserId, false);
      logInfo(`🔄 [Gemini Bridge] Manual takeover - stopped conversation with ${rawFrom}`);
      return { handled: true };
    }

    if (result.isHelpCall) {
      geminiConversationService.stopConversation(canonicalUserId, false);
      logInfo(`🆘 [Gemini Bridge] Help call from ${rawFrom} - conversation stopped`);
      return { handled: true };
    }

    if (result.isFinishCall) {
      geminiConversationService.stopConversation(canonicalUserId, true);
      logInfo(`✅ [Gemini Bridge] Finish call from ${rawFrom} - conversation stopped and marked finished`);
      return { handled: true };
    }

    if (result.isFunctionCall && result.messages && result.messages.length > 0) {
      for (const msg of result.messages) {
        const text = msg.text || '';
        if (text) {
          const processed = await processAiResponse(text, { userId: canonicalUserId });
          await client.sendMessage(rawFrom, processed, { sendSeen: false });
        }
      }
      logInfo(`✅ [Gemini Bridge] Sent ${result.messages.length} predefined messages to ${rawFrom}`);
      return { handled: true };
    }

    if (!result.response) {
      return { handled: true };
    }

    const processedText = await processAiResponse(result.response, { userId: canonicalUserId });
    await client.sendMessage(rawFrom, processedText, { sendSeen: false });
    logInfo(`✅ [Gemini Bridge] Sent AI response to ${rawFrom}`);

    return { handled: true };
  } catch (err) {
    logError('❌ [Gemini Bridge] Error handling message:', err);
    return { handled: true, error: err.message };
  }
}

// =============== PUBLIC API - לשימוש עתידי ===============

/**
 * בודק אם משתמש נתון בשיחה פעילה עם AI
 * @param {string} userId - מזהה משתמש
 * @returns {boolean}
 */
export function isUserInActiveConversation(userId) {
  return (
    (geminiConversationService.isUserActive?.(userId) ||
      geminiConversationService.isUserActive?.(normalizeUserId(userId))) ??
    false
  );
}

/**
 * שליחת תשובה ידנית ממשתמש אחר (למשל מ-API) - עבור מימושים עתידיים
 * @param {string} userId - מזהה משתמש
 * @param {string} responseText - טקסט התשובה
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendGeminiResponseToUser(userId, responseText) {
  try {
    const client = getClient();
    if (!client) {
      return { success: false, error: 'WhatsApp client not available' };
    }
    const processed = await processAiResponse(responseText || '', { userId });
    await client.sendMessage(userId, processed, { sendSeen: false });
    return { success: true };
  } catch (err) {
    logError('❌ [Gemini Bridge] sendGeminiResponseToUser error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * מאתחל את הגשר - נרשם ל-WhatsApp ומפעיל את עיבוד ההודעות
 * קוראים לפונקציה הזו בהפעלת האפליקציה (index.js)
 */
export function initGeminiWhatsAppBridge() {
  registerIncomingMessageHandler(handleIncomingMessage);
  logInfo('✅ [Gemini Bridge] Registered with WhatsApp message handler');
}
