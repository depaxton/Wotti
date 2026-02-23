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
  getNeverSendList,
  getSentList,
  getSettings,
  updateSettings,
  getEligibleToSend,
  pickRandomMessage,
  incrementSentToday,
  addToSent,
  removeFromSent,
  phoneToChatId,
  normalizePhoneForStorage,
} from "../services/marketingDistributionService.js";
import { getClient, isClientReady } from "../services/whatsappClient.js";
import { runTickNow } from "../services/marketingDistributionScheduler.js";
import { logError, logInfo } from "../utils/logger.js";
import XLSX from "xlsx";

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
 * Returns { items: [{ phone, name? }, ...] }
 */
export async function getToSendController(req, res) {
  try {
    const list = await getToSendList();
    res.json({ items: list, phones: list.map((e) => e.phone) });
  } catch (e) {
    logError("marketingDistribution getToSend", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * POST /api/marketing-distribution/to-send
 * Body: { phones?: string[], items?: { phone, name? }[], replace?: boolean } — replace=false means add only
 */
export async function postToSendController(req, res) {
  try {
    const { phones, items, replace } = req.body || {};
    const toAdd = Array.isArray(items) ? items : (Array.isArray(phones) ? phones.map((p) => ({ phone: p, name: "" })) : []);
    if (replace === true) {
      const list = await setToSendList(toAdd);
      return res.json({ items: list });
    }
    const list = await addManyToSend(toAdd);
    res.json({ items: list });
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
 * DELETE /api/marketing-distribution/sent/:phone
 * Remove one entry from the sent list (by phone).
 */
export async function deleteFromSentController(req, res) {
  try {
    const phone = req.params.phone;
    if (!phone) return res.status(400).json({ error: "Missing phone" });
    const removed = await removeFromSent(phone);
    if (!removed) return res.status(404).json({ error: "Not found in sent list" });
    res.json({ success: true });
  } catch (e) {
    logError("marketingDistribution deleteFromSent", e);
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
    if (settings.enabled) {
      runTickNow();
    }
  } catch (e) {
    logError("marketingDistribution postSettings", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/never-send
 * Returns { items: [{ phone, name? }], phones: string[] }
 */
export async function getNeverSendController(req, res) {
  try {
    const list = await getNeverSendList();
    res.json({ items: list, phones: list.map((e) => e.phone) });
  } catch (e) {
    logError("marketingDistribution getNeverSend", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * GET /api/marketing-distribution/status
 * For UI: counts, settings summary, eligible count
 */
export async function getStatusController(req, res) {
  try {
    const [toSend, sent, neverSend, settings, eligible] = await Promise.all([
      getToSendList(),
      getSentList(),
      getNeverSendList(),
      getSettings(),
      getEligibleToSend(),
    ]);
    res.json({
      toSendCount: toSend.length,
      sentCount: sent.length,
      neverSendCount: neverSend.length,
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
    const entry = eligible[0];
    const phone = entry.phone;
    const name = entry.name || "";
    const chatId = phoneToChatId(phone);
    if (!chatId) {
      return res.status(400).json({ error: "Invalid phone" });
    }
    const msg = pickRandomMessage(messages);
    await client.sendMessage(chatId, msg.text);
    await addToSent(phone, name);
    await removeFromToSend(phone);
    await incrementSentToday();
    logInfo(`Marketing distribution: sent to ${phone}`);
    res.json({ success: true, phone, name, messageId: msg.id });
  } catch (e) {
    logError("marketingDistribution sendOne", e);
    res.status(500).json({ error: e.message });
  }
}

/**
 * Israeli normalized: 972 + 9 digits. Valid for column detection and row import.
 */
function isValidIsraeliNormalized(str) {
  const n = normalizePhoneForStorage(str);
  return n.length === 12 && n.startsWith("972");
}

/**
 * Detect Israeli phone column index: column with most values that normalize to 972 + 9 digits
 */
function detectPhoneColumn(rows) {
  let bestCol = -1;
  let bestCount = 0;
  const maxCol = rows.length ? Math.max(...rows.map((r) => (r && r.length) || 0)) : 0;
  for (let c = 0; c < maxCol; c++) {
    let count = 0;
    for (let r = 0; r < rows.length; r++) {
      const cell = rows[r] && rows[r][c];
      if (isValidIsraeliNormalized(String(cell ?? "").trim())) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestCol = c;
    }
  }
  return bestCol;
}

/**
 * Detect name column: first column with header like "שם" / "name" or second text column if no header
 */
function detectNameColumn(rows, phoneCol) {
  if (!rows.length) return -1;
  const header = rows[0] || [];
  const nameKeywords = ["שם", "name", "שם מלא", "שם פרטי"];
  for (let c = 0; c < header.length; c++) {
    if (c === phoneCol) continue;
    const h = String(header[c] ?? "").trim().toLowerCase();
    if (nameKeywords.some((k) => h.includes(k.toLowerCase()))) return c;
  }
  return phoneCol === 0 ? 1 : 0;
}

/** Normalize raw cell value for Israeli phone (Excel may store as number without leading 0) */
function rawToPhoneString(raw) {
  let s = raw == null ? "" : String(raw).trim();
  if (s === "" && typeof raw === "number") s = String(raw);
  if (/^\d{9}$/.test(s) && s.startsWith("5")) s = "0" + s;
  return s;
}

/**
 * POST /api/marketing-distribution/import-excel
 * multipart file: Excel file. No row limit – imports all rows. Detects phone + name columns, adds to to-send.
 */
export async function importExcelController(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "לא נבחר קובץ או שהקובץ ריק" });
    }
    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) {
      return res.status(400).json({ error: "לא נמצא גיליון בקובץ" });
    }
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
    if (!rows.length) {
      return res.status(400).json({ error: "הקובץ ריק" });
    }
    const phoneCol = detectPhoneColumn(rows);
    if (phoneCol < 0) {
      return res.status(400).json({ error: "לא נמצאה עמודה עם מספרי טלפון ישראליים (05x או 972...)" });
    }
    const nameCol = detectNameColumn(rows, phoneCol);
    const items = [];
    for (let r = 1; r < rows.length; r++) {
      const rawPhone = rows[r] && rows[r][phoneCol];
      const phoneStr = rawToPhoneString(rawPhone);
      const normalized = normalizePhoneForStorage(phoneStr);
      if (normalized.length === 12 && normalized.startsWith("972")) {
        const name = nameCol >= 0 && rows[r] && rows[r][nameCol] != null ? String(rows[r][nameCol]).trim() : "";
        items.push({ phone: normalized, name });
      }
    }
    if (!items.length) {
      return res.status(400).json({ error: "לא נמצאו מספרי טלפון תקינים בייבוא (פורמט ישראלי: 05x או 972...)" });
    }
    const list = await addManyToSend(items);
    logInfo(`Marketing: Excel import added ${items.length} contacts (no limit), total to-send: ${list.length}`);
    res.json({ success: true, added: items.length, totalToSend: list.length });
  } catch (e) {
    logError("marketingDistribution importExcel", e);
    res.status(500).json({ error: e.message });
  }
}
