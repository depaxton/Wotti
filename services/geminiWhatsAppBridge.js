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

import fs from 'fs/promises';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { getClient, registerIncomingMessageHandler, isMessageConsideredNew } from './whatsappClient.js';
import * as geminiConversationService from './geminiConversationService.js';
import * as readyMessagesService from './readyMessagesService.js';
import { processAiResponse } from './aiCommandMiddleware.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const INDEX_PATTERN = /\[\s*INDEX\s*=\s*(\d+)\s*\]/gi;

/** מחפש [INDEX=N] בתגובה (N = מספר). מחזיר { index, cleanText } או null */
function parseIndexFromResponse(text) {
  const str = String(text || '');
  logInfo(`🔍 [parseIndex] Input text (last 200 chars): "${str.slice(-200)}"`);
  
  // בדיקה פשוטה עם regex חדש (לא גלובלי) כדי למנוע בעיות lastIndex
  const simpleMatch = str.match(/\[\s*INDEX\s*=\s*(\d+)\s*\]/i);
  logInfo(`🔍 [parseIndex] Simple match result: ${simpleMatch ? JSON.stringify(simpleMatch[0]) : 'null'}`);
  
  if (!simpleMatch) return null;
  
  const index = parseInt(simpleMatch[1], 10);
  // Preserve newlines so QUERY_CATEGORIES / QUERY_TREATMENTS lists stay one option per line; only collapse spaces/tabs
  const cleanText = str.replace(/\[\s*INDEX\s*=\s*(\d+)\s*\]/gi, ' ').replace(/[ \t]+/g, ' ').trim();
  logInfo(`🔍 [parseIndex] Found INDEX=${index}, cleanText: "${cleanText.slice(-100)}..."`);
  return { index, cleanText };
}

/** מסיר [INDEX=N] מטקסט ומחזיר טקסט מנוקה (לשימוש כשמזהים מהתגובה הגולמית). שומר שורות חדשות כדי שרשימות אופציות יוצגו בשורה נפרדת. */
function stripIndexFromText(text) {
  if (!text || typeof text !== 'string') return (text || '').trim();
  INDEX_PATTERN.lastIndex = 0;
  const out = text.replace(INDEX_PATTERN, ' ').replace(/[ \t]+/g, ' ').trim();
  INDEX_PATTERN.lastIndex = 0;
  return out;
}

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
  if (!message) {
    return { handled: false };
  }

  // התעלם מהודעות סטטוס/סטורי – שליחה אליהן תפרסם תשובות כסטורי בטעות
  if (message.from === 'status@broadcast' || message.isStatus === true) {
    return { handled: false };
  }

  // הודעות מטעינת צ'אטים בהתחלה – לא לטפל, כדי שה-AI לא ייכנס לשיחות בטעות
  if (!message.fromMe && !isMessageConsideredNew(message)) {
    return { handled: false };
  }

  const rawFrom = message.from;
  const messageText = (message.body || '').trim();
  if (!messageText) {
    return { handled: false };
  }

  const normalizedFrom = normalizeUserId(rawFrom);

  // הודעה מהמפעיל (מאיתנו) – אם בשיחה פעילה עם AI ומופיעה מילת יציאה, עוצרים את השיחה
  if (message.fromMe) {
    const canonicalUserId = geminiConversationService.isUserActive?.(rawFrom)
      ? rawFrom
      : geminiConversationService.isUserActive?.(normalizedFrom)
        ? normalizedFrom
        : null;
    if (canonicalUserId && geminiConversationService.shouldExitByOperatorWords?.(messageText)) {
      geminiConversationService.stopConversation(canonicalUserId);
      logInfo(`🚪 [Gemini Bridge] Operator said exit word – conversation stopped with ${rawFrom}`);
      return { handled: true };
    }
    return { handled: false };
  }

  let canonicalUserId = geminiConversationService.isUserActive?.(rawFrom)
    ? rawFrom
    : geminiConversationService.isUserActive?.(normalizedFrom)
      ? normalizedFrom
      : null;

  let justActivated = false;
  if (!canonicalUserId) {
    const activated = await geminiConversationService.tryActivateByWords?.(rawFrom, messageText);
    if (activated?.activated && activated.canonicalUserId) {
      canonicalUserId = activated.canonicalUserId;
      justActivated = true;
    } else {
      return { handled: false };
    }
  }

  if (geminiConversationService.shouldExitByUserWords?.(messageText)) {
    geminiConversationService.stopConversation(canonicalUserId);
    logInfo(`🚪 [Gemini Bridge] User said exit word – conversation stopped with ${rawFrom}`);
    return { handled: true };
  }

  // באירוע הודעה מהלקוח: קוראים את השיחה ובודקים אם ההודעה האחרונה שלנו מכילה מילת טריגר יציאה
  const operatorSaidExit = await geminiConversationService.didOperatorSayExitInLastMessages?.(canonicalUserId);
  if (operatorSaidExit) {
    geminiConversationService.stopConversation(canonicalUserId);
    logInfo(`🚪 [Gemini Bridge] Operator exit word in last message – conversation stopped with ${rawFrom}, not responding`);
    return { handled: true };
  }

  // הודעה שהפעילה את השיחה – startConversation כבר שלח תשובה, לא לעבד שוב (למנוע תגובה כפולה)
  if (justActivated) {
    logInfo(`✅ [Gemini Bridge] Conversation just activated for ${rawFrom}, skipping duplicate processing`);
    return { handled: true };
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

    const stillActive =
      geminiConversationService.isUserActive?.(canonicalUserId) ||
      geminiConversationService.isUserActive?.(normalizedFrom);
    if (!stillActive) {
      logInfo(`🚪 [Gemini Bridge] User no longer active (e.g. said exit word), not sending AI response to ${rawFrom}`);
      return { handled: true };
    }

    if (result.isManualTakeover) {
      geminiConversationService.stopConversation(canonicalUserId);
      logInfo(`🔄 [Gemini Bridge] Manual takeover - stopped conversation with ${rawFrom}`);
      return { handled: true };
    }

    if (result.isHelpCall) {
      geminiConversationService.stopConversation(canonicalUserId);
      logInfo(`🆘 [Gemini Bridge] Help call from ${rawFrom} - conversation stopped`);
      return { handled: true };
    }

    if (result.isFinishCall) {
      geminiConversationService.stopConversation(canonicalUserId);
      logInfo(`✅ [Gemini Bridge] Finish call from ${rawFrom} - conversation stopped`);
      return { handled: true };
    }

    if (!result.response) {
      return { handled: true };
    }

    if (
      !geminiConversationService.isUserActive?.(canonicalUserId) &&
      !geminiConversationService.isUserActive?.(normalizedFrom)
    ) {
      logInfo(`🚪 [Gemini Bridge] User no longer active, not sending final AI response to ${rawFrom}`);
      return { handled: true };
    }
    // זיהוי [INDEX=N] בתגובה הגולמית לפני processAiResponse – כדי שפקודות middleware (למשל [QUERY_CATEGORIES: ...]) לא "יבלעו" את [INDEX=N]
    logInfo(`🔍 [Gemini Bridge] Raw AI response (last 300 chars): "${result.response.slice(-300)}"`);
    const rawParsed = parseIndexFromResponse(result.response);
    logInfo(`🔍 [Gemini Bridge] rawParsed: ${rawParsed ? JSON.stringify(rawParsed) : 'null'}`);
    
    const processed = await processAiResponse(result.response, { userId: canonicalUserId });
    logInfo(`🔍 [Gemini Bridge] processed.text (last 300 chars): "${processed.text.slice(-300)}"`);
    
    const parsed = rawParsed
      ? { index: rawParsed.index, cleanText: stripIndexFromText(processed.text) }
      : parseIndexFromResponse(processed.text);
    logInfo(`🔍 [Gemini Bridge] Final parsed: ${parsed ? JSON.stringify({ index: parsed.index, cleanTextLen: parsed.cleanText?.length }) : 'null'}`);
    
    if (parsed) {
      logInfo(`🔍 [Gemini Bridge] parsed found! index=${parsed.index}, calling getMessageByIndex...`);
      const readyMsg = await readyMessagesService.getMessageByIndex(parsed.index);
      logInfo(`🔍 [Gemini Bridge] readyMsg result: ${readyMsg ? JSON.stringify({ id: readyMsg.id, index: readyMsg.index, mediaPath: readyMsg.mediaPath, mimeType: readyMsg.mimeType, text: readyMsg.text }) : 'null'}`);
      
      if (readyMsg) {
        const caption = (readyMsg.text || '').replace(/\[TEXT\]/g, parsed.cleanText);
        logInfo(`🔍 [Gemini Bridge] caption after [TEXT] replacement: "${caption.slice(0, 200)}..."`);
        
        if (readyMsg.mediaPath && readyMsg.mimeType) {
          logInfo(`🔍 [Gemini Bridge] Has media! mediaPath=${readyMsg.mediaPath}, mimeType=${readyMsg.mimeType}`);
          try {
            const fullPath = readyMessagesService.getMediaPath(readyMsg.mediaPath);
            logInfo(`🔍 [Gemini Bridge] Full media path: ${fullPath}`);
            const buffer = await fs.readFile(fullPath);
            logInfo(`🔍 [Gemini Bridge] Read file successfully, size=${buffer.length} bytes`);
            const base64 = buffer.toString('base64');
            const messageMedia = new MessageMedia(readyMsg.mimeType, base64);
            logInfo(`🔍 [Gemini Bridge] Sending media message to ${rawFrom}...`);
            await client.sendMessage(rawFrom, messageMedia, { caption, sendSeen: false });
            logInfo(`✅ [Gemini Bridge] Media message sent successfully!`);
          } catch (err) {
            logError('❌ [Gemini Bridge] Failed to send ready message media, falling back to caption:', err);
            if (caption) await client.sendMessage(rawFrom, caption, { sendSeen: false });
          }
        } else if (caption) {
          logInfo(`🔍 [Gemini Bridge] No media, sending caption only`);
          await client.sendMessage(rawFrom, caption, { sendSeen: false });
        }
        logInfo(`✅ [Gemini Bridge] Sent ready message INDEX=${parsed.index} (with [TEXT] substitution) to ${rawFrom}`);
      } else {
        // אין הודעה מוכנה עם האינדקס – שולחים רק את הטקסט המנוקה (בלי [INDEX=N]) כדי שהמשתמש לא יראה את התגית
        await client.sendMessage(rawFrom, parsed.cleanText, { sendSeen: false });
        logInfo(`✅ [Gemini Bridge] [INDEX=${parsed.index}] not found – sent clean text only to ${rawFrom}`);
      }
    } else {
      await client.sendMessage(rawFrom, processed.text, { sendSeen: false });
      logInfo(`✅ [Gemini Bridge] Sent AI response to ${rawFrom}`);
    }
    const isBookingSuccess =
      processed.stopConversation || (processed.text && processed.text.includes('התור נקבע בהצלחה'));
    if (isBookingSuccess) {
      geminiConversationService.stopConversation(canonicalUserId);
      logInfo(`✅ [Gemini Bridge] Appointment booked – conversation ended with ${rawFrom}`);
    }
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
    
    // בדיקת [INDEX=N] לפני processAiResponse
    const rawParsed = parseIndexFromResponse(responseText || '');
    const processed = await processAiResponse(responseText || '', { userId });
    const parsed = rawParsed
      ? { index: rawParsed.index, cleanText: stripIndexFromText(processed.text) }
      : parseIndexFromResponse(processed.text);
    
    if (parsed) {
      const readyMsg = await readyMessagesService.getMessageByIndex(parsed.index);
      if (readyMsg) {
        const caption = (readyMsg.text || '').replace(/\[TEXT\]/g, parsed.cleanText);
        if (readyMsg.mediaPath && readyMsg.mimeType) {
          try {
            const fullPath = readyMessagesService.getMediaPath(readyMsg.mediaPath);
            const buffer = await fs.readFile(fullPath);
            const base64 = buffer.toString('base64');
            const messageMedia = new MessageMedia(readyMsg.mimeType, base64);
            await client.sendMessage(userId, messageMedia, { caption, sendSeen: false });
          } catch (err) {
            logError('❌ [Gemini Bridge] sendGeminiResponseToUser - failed to send media:', err);
            if (caption) await client.sendMessage(userId, caption, { sendSeen: false });
          }
        } else if (caption) {
          await client.sendMessage(userId, caption, { sendSeen: false });
        }
        logInfo(`✅ [Gemini Bridge] sendGeminiResponseToUser - sent ready message INDEX=${parsed.index} to ${userId}`);
      } else {
        await client.sendMessage(userId, parsed.cleanText, { sendSeen: false });
        logInfo(`✅ [Gemini Bridge] sendGeminiResponseToUser - INDEX=${parsed.index} not found, sent clean text to ${userId}`);
      }
    } else {
      await client.sendMessage(userId, processed.text, { sendSeen: false });
    }
    
    if (processed.stopConversation) {
      geminiConversationService.stopConversation(userId);
      logInfo(`✅ [Gemini Bridge] Appointment booked – conversation ended with ${userId}`);
    }
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
