// Marketing Distribution Controller
// API handlers for messages, to-send list, sent list, and settings

import {
  getMessages,
  addMessage,
  updateMessage,
  deleteMessage,
  getToSendList,
  setToSendList,
  addToSend,
  addManyToSend,
  removeFromToSend,
  getSentList,
  getSettings,
  updateSettings,
  getEligibleToSend,
  pickRandomMessage,
  incrementSentToday,
  addToSent,
  phoneToChatId,
  normalizePhoneForStorage,
} from "../services/marketingDistributionService.js";
import { getClient, isClientReady } from "../services/whatsappClient.js";
import { logError, logInfo } from "../utils/logger.js";

const API_PREFIX = "/api/marketing-distribution";

/**
 * GET /api/marketing-distribution/messages
 */
export async function getMessagesController(req, res) {
  try {
    const list = await getMessages();
    res.json({ messages: list });
  } catch (e) {
    logError("marketingDistribution getMessages", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * POST /api/marketing-distribution/messages
 * Body: { text }
 */
export async function postMessageController(req, res) {
  try {
    const { text } = req.body || {};
    const item = await addMessage(text);
    res.status(201).json(item);
  } catch (e) {
    logError("marketingDistribution postMessage", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * PUT /api/marketing-distribution/messages/:id
 * Body: { text }
 */
export async function putMessageController(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { text } = req.body || {};
    const updated = await updateMessage(id, text);
    if (!updated) return res.status(404).json({ error: "Message not found" });
    res.json(updated);
  } catch (e) {
    logError("marketingDistribution putMessage", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * DELETE /api/marketing-distribution/messages/:id
 */
export async function deleteMessageController(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const ok = await deleteMessage(id);
    if (!ok) return res.status(404).json({ error: "Message not found" });
    res.json({ success: true });
  } catch (e) {
    logError("marketingDistribution deleteMessage", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/to-send
 */
export async function getToSendController(req, res) {
  try {
    const list = await getToSendList();
    res.json({ phones: list });
  } catch (e) {
    logError("marketingDistribution getToSend", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * POST /api/marketing-distribution/to-send
 * Body: { phones: string[], replace?: boolean } — replace=false means add only
 */
export async function postToSendController(req, res) {
  try {
    const { phones, replace } = req.body || {};
    if (replace === true) {
      const list = await setToSendList(phones);
      return res.json({ phones: list });
    }
    const list = await addManyToSend(phones);
    res.json({ phones: list });
  } catch (e) {
    logError("marketingDistribution postToSend", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * DELETE /api/marketing-distribution/to-send/:phone
 * phone can be raw or encoded (digits only in path)
 */
export async function deleteFromToSendController(req, res) {
  try {
    const phone = req.params.phone ? decodeURIComponent(req.params.phone) : "";
    const list = await removeFromToSend(phone);
    res.json({ phones: list });
  } catch (e) {
    logError("marketingDistribution deleteFromToSend", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/sent
 */
export async function getSentController(req, res) {
  try {
    const list = await getSentList();
    res.json({ sent: list });
  } catch (e) {
    logError("marketingDistribution getSent", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/settings
 */
export async function getSettingsController(req, res) {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (e) {
    logError("marketingDistribution getSettings", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * POST /api/marketing-distribution/settings
 * Body: partial settings (enabled, startHour, endHour, resumeHour, dailyLimit, delayMinutes)
 */
export async function postSettingsController(req, res) {
  try {
    const settings = await updateSettings(req.body || {});
    res.json(settings);
  } catch (e) {
    logError("marketingDistribution postSettings", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/status
 * For UI: counts, settings summary, eligible count
 */
export async function getStatusController(req, res) {
  try {
    const [toSend, sent, settings, eligible] = await Promise.all([
      getToSendList(),
      getSentList(),
      getSettings(),
      getEligibleToSend(),
    ]);
    res.json({
      toSendCount: toSend.length,
      sentCount: sent.length,
      eligibleToSendCount: eligible.length,
      settings,
    });
  } catch (e) {
    logError("marketingDistribution getStatus", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * POST /api/marketing-distribution/send-one
 * Sends one message to the next eligible number (for manual test). Respects enabled and limits.
 */
export async function sendOneController(req, res) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return res.status(400).json({ error: "Marketing distribution is disabled" });
    }
    const messages = await getMessages();
    if (!messages.length) {
      return res.status(400).json({ error: "No messages in pool" });
    }
    const eligible = await getEligibleToSend();
    if (!eligible.length) {
      return res.json({ message: "No one eligible to send", sent: false });
    }
    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "WhatsApp client not initialized" });
    }
    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: "WhatsApp client not ready" });
    }
    const phone = eligible[0];
    const chatId = phoneToChatId(phone);
    if (!chatId) {
      return res.status(400).json({ error: "Invalid phone" });
    }
    const msg = pickRandomMessage(messages);
    await client.sendMessage(chatId, msg.text);
    await addToSent(phone);
    await removeFromToSend(phone);
    await incrementSentToday();
    logInfo(`Marketing distribution: sent to ${phone}`);
    res.json({ success: true, phone, messageId: msg.id });
  } catch (e) {
    logError("marketingDistribution sendOne", e);
    res.status(500).json({ error: e.message });
  }
}
