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
  neverSend: path.join(UTILS_DIR, "marketing_distribution_never_send.json"),
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

// --- To-send list (each item: { phone, name? }) ---

function toSendEntry(item) {
  if (item == null) return null;
  if (typeof item === "object" && item.phone != null) {
    const phone = normalizePhoneForStorage(item.phone);
    return phone ? { phone, name: item.name != null ? String(item.name).trim() : "" } : null;
  }
  const phone = normalizePhoneForStorage(item);
  return phone ? { phone, name: "" } : null;
}

function phoneSet(list) {
  return new Set((list || []).map((e) => (typeof e === "object" && e.phone != null ? e.phone : e)));
}

export async function getToSendList() {
  const list = await readJson(FILES.toSend, []);
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (typeof item === "object" && item.phone != null) return { phone: item.phone, name: item.name != null ? String(item.name) : "" };
    return { phone: String(item), name: "" };
  });
}

export async function setToSendList(phonesOrItems) {
  const neverList = await getNeverSendList();
  const neverSet = neverSendPhonesSet(neverList);
  const arr = Array.isArray(phonesOrItems) ? phonesOrItems : [];
  const seen = new Set();
  const normalized = [];
  for (const p of arr) {
    const entry = toSendEntry(p);
    if (!entry || !entry.phone.length || neverSet.has(entry.phone) || seen.has(entry.phone)) continue;
    seen.add(entry.phone);
    normalized.push(entry);
  }
  await writeJson(FILES.toSend, normalized);
  return normalized;
}

export async function addToSend(phone, name = "") {
  const [list, neverList] = await Promise.all([getToSendList(), getNeverSendList()]);
  const entry = toSendEntry({ phone, name });
  if (!entry || phoneSet(list).has(entry.phone) || neverSendPhonesSet(neverList).has(entry.phone)) return list;
  list.push(entry);
  await writeJson(FILES.toSend, list);
  return list;
}

export async function addManyToSend(phonesOrItems) {
  const [list, neverList] = await Promise.all([getToSendList(), getNeverSendList()]);
  const neverSet = neverSendPhonesSet(neverList);
  const listPhones = phoneSet(list);
  const toAdd = [];
  for (const p of Array.isArray(phonesOrItems) ? phonesOrItems : []) {
    const entry = toSendEntry(p);
    if (!entry || !entry.phone.length || listPhones.has(entry.phone) || neverSet.has(entry.phone)) continue;
    listPhones.add(entry.phone);
    toAdd.push(entry);
  }
  if (toAdd.length === 0) return list;
  const next = [...list, ...toAdd];
  await writeJson(FILES.toSend, next);
  return next;
}

export async function removeFromToSend(phone) {
  const list = await getToSendList();
  const normalized = normalizePhoneForStorage(phone);
  const filtered = list.filter((e) => (e && e.phone) !== normalized);
  if (filtered.length === list.length) return list;
  await writeJson(FILES.toSend, filtered);
  return filtered;
}

// --- Never send list (לעולם לא לשלוח), each item: { phone, name? } ---

function neverSendPhonesSet(list) {
  return new Set(
    (list || []).map((e) => (typeof e === "object" && e && e.phone != null ? e.phone : e))
  );
}

export async function getNeverSendList() {
  const list = await readJson(FILES.neverSend, []);
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (typeof item === "object" && item && item.phone != null) {
      return { phone: item.phone, name: item.name != null ? String(item.name) : "" };
    }
    return { phone: String(item), name: "" };
  });
}

export async function addToNeverSend(phone, name = "") {
  const list = await getNeverSendList();
  const normalized = normalizePhoneForStorage(phone);
  if (!normalized) return list;
  if (neverSendPhonesSet(list).has(normalized)) return list;
  list.push({ phone: normalized, name: name != null ? String(name).trim() : "" });
  await writeJson(FILES.neverSend, list);
  logInfo(`Marketing: added to never-send list: ${normalized} (${name || "—"})`);
  return list;
}

export function isInNeverSend(neverList, phone) {
  const normalized = normalizePhoneForStorage(phone);
  return neverList && neverSendPhonesSet(neverList).has(normalized);
}

// --- Sent list ---

export async function getSentList() {
  const list = await readJson(FILES.sent, []);
  return Array.isArray(list) ? list : [];
}

export async function addToSent(phone, name = "") {
  const list = await getSentList();
  const normalized = normalizePhoneForStorage(phone);
  const entry = { phone: normalized, sentAt: new Date().toISOString(), name: name != null ? String(name) : "" };
  list.push(entry);
  await writeJson(FILES.sent, list);
  return list;
}

export function getSentSet(sentList) {
  return new Set((sentList || []).map((e) => e.phone));
}

/** Normalize phone to digits; Israeli 0xx -> 972xx; 9 digits starting with 5 -> 9725... (Excel numeric) */
export function normalizePhoneForStorage(phone) {
  let digits = String(phone || "").replace(/\D/g, "").trim();
  if (digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) {
    digits = "972" + digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith("5")) {
    digits = "972" + digits;
  }
  return digits;
}

/** Build WhatsApp chatId from phone (digits) */
export function phoneToChatId(phone) {
  const digits = normalizePhoneForStorage(phone);
  return digits ? `${digits}@c.us` : null;
}

// Returns to-send entries that are not in sent and not in neverSend (eligible for sending)
export async function getEligibleToSend() {
  const [toSend, sentList, neverList] = await Promise.all([
    getToSendList(),
    getSentList(),
    getNeverSendList(),
  ]);
  const sentSet = getSentSet(sentList);
  const neverSet = neverSendPhonesSet(neverList);
  return toSend.filter((e) => e && e.phone && !sentSet.has(e.phone) && !neverSet.has(e.phone));
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
