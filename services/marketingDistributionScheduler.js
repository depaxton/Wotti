// Marketing Distribution Scheduler
// Sends messages within time window, daily limit, and delay between sends

import { getClient, isClientReady } from "./whatsappClient.js";
import {
  getSettings,
  getEligibleToSend,
  getMessages,
  pickRandomMessage,
  addToSent,
  removeFromToSend,
  incrementSentToday,
  setLastSentAt,
  resetSentTodayIfNeeded,
  phoneToChatId,
  addToNoWhatsAppSend,
} from "./marketingDistributionService.js";
import { logError, logInfo, logWarn } from "../utils/logger.js";

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute
let intervalId = null;

function isWithinTimeWindow(now, startHour, startMinute, endHour, endMinute) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = Number(startHour) * 60 + (Number(startMinute) || 0);
  const end = Number(endHour) * 60 + (Number(endMinute) || 0);
  if (start <= end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

function isDelayElapsed(now, lastSentAt, delayMinutes) {
  if (!lastSentAt) return true;
  const last = new Date(lastSentAt).getTime();
  const elapsed = (now.getTime() - last) / (60 * 1000);
  return elapsed >= Number(delayMinutes) || elapsed < 0;
}

/**
 * Single tick: reset daily if needed, then maybe send one message
 */
async function tick() {
  let phone, name;
  try {
    await resetSentTodayIfNeeded();
    const settings = await getSettings();
    if (!settings.enabled) return;

    const now = new Date();
    if (!isWithinTimeWindow(now, settings.startHour, settings.startMinute, settings.endHour, settings.endMinute)) return;
    if ((settings.sentToday || 0) >= (settings.dailyLimit || 0)) return;
    if (!isDelayElapsed(now, settings.lastSentAt, settings.delayMinutes)) return;

    const messages = await getMessages();
    if (!messages.length) return;

    const eligible = await getEligibleToSend();
    if (!eligible.length) return;

    const client = getClient();
    if (!client) return;
    const ready = await isClientReady();
    if (!ready) return;

    const entry = eligible[0];
    phone = entry.phone;
    name = entry.name || "";
    const chatId = phoneToChatId(phone);
    if (!chatId) return;

    const msg = pickRandomMessage(messages);
    await client.sendMessage(chatId, msg.text);
    await addToSent(phone, name);
    await removeFromToSend(phone);
    await incrementSentToday();
    await setLastSentAt(now.toISOString());
    logInfo(`Marketing distribution: sent to ${phone} (message #${msg.id})`);
  } catch (e) {
    const errMsg = (e && (e.message || e.toString())) || "";
    if (phone) {
      await addToNoWhatsAppSend(phone, name || "");
      await removeFromToSend(phone);
      logError(`Marketing distribution: שגיאה בשליחה ל־${phone} – הועבר לרשימת לא הצליח. השגיאה: ${errMsg}`, e);
      // אחרי כישלון: 10 שניות בלבד ואז ניסיון לבא בתור (בלי להמתין את ההשהייה מההגדרות)
      logInfo("Marketing distribution: ממתין 10 שניות לפני ניסיון לשלוח לבא בתור");
      setTimeout(() => tick().catch((err) => logError("marketingDistributionScheduler tick (after failure)", err)), 10 * 1000);
    } else {
      logError("marketingDistributionScheduler tick", e);
    }
  }
}

/**
 * Run one tick immediately (e.g. when user just enabled distribution).
 * Safe to call from API – runs in background, does not block response.
 */
export function runTickNow() {
  tick().catch((e) => logError("marketingDistributionScheduler runTickNow", e));
}

export function startMarketingDistributionScheduler() {
  if (intervalId) return;
  intervalId = setInterval(tick, CHECK_INTERVAL_MS);
  logInfo("Marketing distribution scheduler started");
}

export function stopMarketingDistributionScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logInfo("Marketing distribution scheduler stopped");
  }
}
