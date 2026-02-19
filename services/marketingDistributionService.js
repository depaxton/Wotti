// Marketing Distribution Service
// Manages messages pool, to-send list, sent list, and settings (file-based storage)

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { logError, logInfo } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UTILS_DIR = path.resolve(__dirname, "..", "utils");

const FILES = {
  messages: path.join(UTILS_DIR, "marketing_distribution_messages.json"),
  toSend: path.join(UTILS_DIR, "marketing_distribution_to_send.json"),
  sent: path.join(UTILS_DIR, "marketing_distribution_sent.json"),
  settings: path.join(UTILS_DIR, "marketing_distribution_settings.json"),
};

const DEFAULT_SETTINGS = {
  enabled: false,
  startHour: 9,
  endHour: 18,
  resumeHour: 8,
  dailyLimit: 50,
  delayMinutes: 5,
  sentToday: 0,
  lastResetDate: null,
  lastSentAt: null,
};

async function readJson(filePath, defaultValue = []) {
  try {
    const data = await fs.readJson(filePath);
    return data != null ? data : defaultValue;
  } catch (e) {
    if (e.code === "ENOENT") return defaultValue;
    logError("marketingDistributionService readJson", e);
    return defaultValue;
  }
}

async function writeJson(filePath, data) {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeJson(filePath, data, { spaces: 2 });
}

// --- Messages ---

export async function getMessages() {
  const list = await readJson(FILES.messages, []);
  return Array.isArray(list) ? list : [];
}

export async function addMessage(text) {
  const list = await getMessages();
  const id = list.length > 0 ? Math.max(...list.map((m) => m.id)) + 1 : 1;
  const item = { id, text: String(text || "").trim(), createdAt: new Date().toISOString() };
  list.push(item);
  await writeJson(FILES.messages, list);
  return item;
}

export async function updateMessage(id, text) {
  const list = await getMessages();
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], text: String(text || "").trim(), updatedAt: new Date().toISOString() };
  await writeJson(FILES.messages, list);
  return list[idx];
}

export async function deleteMessage(id) {
  const list = await getMessages();
  const filtered = list.filter((m) => m.id !== id);
  if (filtered.length === list.length) return false;
  await writeJson(FILES.messages, filtered);
  return true;
}

export function pickRandomMessage(messages) {
  if (!messages || messages.length === 0) return null;
  return messages[Math.floor(Math.random() * messages.length)];
}

// --- To-send list ---

export async function getToSendList() {
  const list = await readJson(FILES.toSend, []);
  return Array.isArray(list) ? list : [];
}

export async function setToSendList(phones) {
  const normalized = (Array.isArray(phones) ? phones : [])
    .map((p) => normalizePhoneForStorage(p))
    .filter((p) => p.length > 0);
  await writeJson(FILES.toSend, [...new Set(normalized)]);
  return normalized;
}

export async function addToSend(phone) {
  const list = await getToSendList();
  const normalized = normalizePhoneForStorage(phone);
  if (!normalized || list.includes(normalized)) return list;
  list.push(normalized);
  await writeJson(FILES.toSend, list);
  return list;
}

export async function addManyToSend(phones) {
  const list = await getToSendList();
  const toAdd = (Array.isArray(phones) ? phones : [])
    .map((p) => normalizePhoneForStorage(p))
    .filter((p) => p.length > 0 && !list.includes(p));
  if (toAdd.length === 0) return list;
  const next = [...list, ...toAdd];
  await writeJson(FILES.toSend, next);
  return next;
}

export async function removeFromToSend(phone) {
  const list = await getToSendList();
  const normalized = normalizePhoneForStorage(phone);
  const filtered = list.filter((p) => p !== normalized);
  if (filtered.length === list.length) return list;
  await writeJson(FILES.toSend, filtered);
  return filtered;
}

// --- Sent list ---

export async function getSentList() {
  const list = await readJson(FILES.sent, []);
  return Array.isArray(list) ? list : [];
}

export async function addToSent(phone) {
  const list = await getSentList();
  const normalized = normalizePhoneForStorage(phone);
  const entry = { phone: normalized, sentAt: new Date().toISOString() };
  list.push(entry);
  await writeJson(FILES.sent, list);
  return list;
}

export function getSentSet(sentList) {
  return new Set((sentList || []).map((e) => e.phone));
}

/** Normalize phone to digits; Israeli 0xx -> 972xx */
export function normalizePhoneForStorage(phone) {
  let digits = String(phone || "").replace(/\D/g, "").trim();
  if (digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) {
    digits = "972" + digits.slice(1);
  }
  return digits;
}

/** Build WhatsApp chatId from phone (digits) */
export function phoneToChatId(phone) {
  const digits = normalizePhoneForStorage(phone);
  return digits ? `${digits}@c.us` : null;
}

// Returns phone numbers that are in toSend but not in sent (eligible for sending)
export async function getEligibleToSend() {
  const [toSend, sentList] = await Promise.all([getToSendList(), getSentList()]);
  const sentSet = getSentSet(sentList);
  return toSend.filter((p) => !sentSet.has(p));
}

// --- Settings ---

export async function getSettings() {
  const data = await readJson(FILES.settings, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...data };
}

export async function updateSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await writeJson(FILES.settings, next);
  return next;
}

export async function incrementSentToday() {
  const s = await getSettings();
  const sentToday = (s.sentToday || 0) + 1;
  await updateSettings({ sentToday });
  return sentToday;
}

export async function resetSentTodayIfNeeded() {
  const s = await getSettings();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const resumeHour = s.resumeHour != null ? Number(s.resumeHour) : 8;
  const lastReset = s.lastResetDate;
  const shouldReset = !lastReset || lastReset !== today;
  if (shouldReset && now.getHours() >= resumeHour) {
    await updateSettings({ sentToday: 0, lastResetDate: today });
    return true;
  }
  return false;
}

export async function setLastSentAt(isoString) {
  await updateSettings({ lastSentAt: isoString });
}
