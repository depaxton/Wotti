/**
 * AI Command Middleware
 *
 * יושב בין ה-AI ללקוח: סורק כל הודעה שיוצאת מה-AI, מזהה פקודות בסוגריים מרובעים,
 * מריץ פונקציות צד-שרת (יומן, שעות פעילות, קטגוריות שירות), ומחליף את הפקודה בתוצאה לפני הצגה ללקוח.
 */

import { loadBusinessHours } from './businessHoursService.js';
import { loadCategories, getCategoryById } from './serviceCategoriesService.js';
import {
  getRemindersForUser,
  updateRemindersForUser,
  findReminderById,
  loadReminders,
  saveReminders,
} from './reminderService.js';
import { getUser } from './userService.js';
import { getClient } from './whatsappClient.js';
import { DEFAULT_PRE_REMINDERS } from '../utils/reminderValidation.js';
import {
  parseTime,
  parseDateString,
  formatDateString,
  getCurrentDate,
  getDayName,
} from '../utils/dateUtils.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMENTSAI_PATH = path.join(__dirname, '../utils/COMMENTSAI.json');
let _commentsCache = null;

function loadCommentsAI() {
  if (_commentsCache) return _commentsCache;
  try {
    if (fs.existsSync(COMMENTSAI_PATH)) {
      _commentsCache = JSON.parse(fs.readFileSync(COMMENTSAI_PATH, 'utf8'));
      return _commentsCache;
    }
  } catch (err) {
    logError('[AI Middleware] Error loading COMMENTSAI.json:', err);
  }
  _commentsCache = {};
  return _commentsCache;
}

/**
 * מחזיר תגובה ממסמך COMMENTSAI לפי מפתח. אם יש vars – מחליף {{key}} בערכים.
 * @param {string} key - מפתח ב-COMMENTSAI.json
 * @param {Record<string, string>} [vars] - ערכים להחלפה בתבנית (למשל { dateDisplay, timeStr, categoryName })
 * @returns {string}
 */
function comment(key, vars = {}) {
  const comments = loadCommentsAI();
  let text = comments[key] != null ? String(comments[key]) : key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v != null ? String(v) : '');
  }
  return text;
}

// Default business hours when not configured (09:00-18:00)
const DEFAULT_BUSINESS_HOURS = { start: '09:00', end: '18:00' };
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// In-memory temporary state for booking flow (per user) – cleared by [ABORT_BOOKING]
const bookingTempState = new Map();
// Last QUERY_CATEGORIES result per user: { list: [{ id, name }] } – for category_number in QUERY_AVAILABILITY / BOOK_APPOINTMENT
const lastCategoriesByUser = new Map();
// Last QUERY_TREATMENTS result per user: { categoryId, list: [{ id, name, durationMinutes, bufferMinutes }] } – for treatment_number
const lastTreatmentsByUser = new Map();
// Last LIST_APPOINTMENTS result per user: { list: [{ id, date, time, title }] } – for number= in CANCEL_APPOINTMENT
const lastAppointmentsListByUser = new Map();

/** Format date for display to client: "יום שני 20.2.2025" */
function formatDateShort(dateStr) {
  const date = parseDateString(dateStr);
  if (!date) return dateStr;
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const dayName = getDayName(date.getDay());
  return `יום ${dayName} ${d}.${m}.${y}`;
}

/**
 * Normalize WhatsApp userId to phone key (e.g. 972501234567@c.us -> 972501234567)
 */
function toPhoneKey(userId) {
  if (!userId || typeof userId !== 'string') return '';
  return userId.replace(/@.*$/, '').trim() || userId;
}

/**
 * Get display name for a client: saved name (from users.json) if set, else WhatsApp push name / name, else phone.
 * @param {string} phone - Phone number (no @c.us)
 * @returns {Promise<string>}
 */
async function getClientDisplayName(phone) {
  if (!phone) return '';
  const saved = await getUser(phone);
  const savedName = saved?.name?.trim();
  if (savedName && savedName !== phone) return savedName;
  try {
    const client = getClient();
    if (client && typeof client.getContactById === 'function') {
      const contactId = `${phone.replace(/\D/g, '')}@c.us`;
      const contact = await client.getContactById(contactId);
      if (contact) {
        const push = (contact.pushname || contact.name || '').trim();
        if (push) return push;
      }
    }
  } catch (_) {
    // ignore
  }
  return savedName || phone;
}

/**
 * Parse key=value pairs from command body
 */
function parseCommandParams(body) {
  const params = {};
  if (!body || typeof body !== 'string') return params;
  const pairs = body.split(',').map((s) => s.trim());
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (key && value) params[key] = value;
    }
  }
  return params;
}

/**
 * Get business hours for a given day of week
 */
function getHoursForDay(businessHours, dayIndex) {
  const key = DAY_KEYS[dayIndex];
  const ranges = businessHours?.[key];
  if (Array.isArray(ranges) && ranges.length > 0) {
    return ranges;
  }
  return [DEFAULT_BUSINESS_HOURS];
}

const SLOT_GRANULARITY_MINUTES = 15;

/**
 * Generate candidate slots (HH:MM) based on category: interval = duration + buffer.
 * Example: duration 50 min + buffer 10 min = 60 min between slots → 9:00, 10:00, 11:00...
 */
function generateSlotsForCategory(ranges, category) {
  const duration = category.durationMinutes;
  const buffer = category.bufferMinutes;
  const intervalMinutes = duration + buffer;
  const slots = [];
  const seen = new Set();

  for (const range of ranges) {
    const [startH, startM] = parseTime(range.start) || [0, 0];
    const [endH, endM] = parseTime(range.end) || [23, 59];
    let m = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (m + duration <= endMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const key = `${h}:${min}`;
      if (!seen.has(key)) {
        seen.add(key);
        slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
      m += intervalMinutes;
    }
  }
  return slots.sort();
}

/**
 * Generate candidate start times (HH:MM) every stepMinutes within business ranges,
 * where [start, start+durationMinutes] fits entirely in some range. Used for treatment-based
 * availability (smart slots: only starts that allow the full treatment duration).
 */
function getCandidateStartTimesForDuration(ranges, durationMinutes, stepMinutes = SLOT_GRANULARITY_MINUTES) {
  const slots = [];
  const seen = new Set();
  for (const range of ranges) {
    const [startH, startM] = parseTime(range.start) || [0, 0];
    const [endH, endM] = parseTime(range.end) || [23, 59];
    let m = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    while (m + durationMinutes <= endMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const key = `${h}:${min}`;
      if (!seen.has(key)) {
        seen.add(key);
        slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
      m += stepMinutes;
    }
  }
  return slots.sort();
}

/**
 * Get all appointments for a date from ALL users (for category overlap / maxPerHour checks).
 * categoryBufferMap: { categoryId: bufferMinutes } - used when reminder has no bufferMinutes
 */
function getAllAppointmentsForDate(reminders, dateStr, categoryBufferMap = {}) {
  const result = [];
  for (const [phone, userReminders] of Object.entries(reminders || {})) {
    if (!Array.isArray(userReminders)) continue;
    for (const r of userReminders) {
      if (r.date !== dateStr) continue;
      const [h, m] = parseTime(r.time) || [0, 0];
      const duration = typeof r.duration === 'number' && r.duration > 0 ? r.duration : 30;
      const buffer = r.bufferMinutes != null ? r.bufferMinutes : ((r.categoryId && categoryBufferMap[r.categoryId]) ?? 0);
      result.push({
        phone,
        startMin: h * 60 + m,
        endMin: h * 60 + m + duration,
        categoryId: r.categoryId || null,
        bufferMinutes: buffer,
      });
    }
  }
  return result;
}

/**
 * Get user's appointments for a date (for same-customer same-hour check)
 */
function getUserAppointmentsForDate(userReminders, dateStr) {
  const result = [];
  for (const r of userReminders || []) {
    if (r.date !== dateStr) continue;
    const [h, m] = parseTime(r.time) || [0, 0];
    result.push({ startMin: h * 60 + m });
  }
  return result;
}

/**
 * Get clock hour (0-23) from slot HH:MM
 */
function getClockHour(slotHHMM) {
  const [h] = parseTime(slotHHMM) || [0, 0];
  return h;
}

/**
 * Check if slot is blocked by same-category appointments (duration + buffer)
 */
function isSlotBlockedByCategory(slotHHMM, slotDuration, categoryId, allAppointments, category) {
  const [h, m] = parseTime(slotHHMM) || [0, 0];
  const slotStart = h * 60 + m;
  const slotEnd = slotStart + slotDuration;
  const buffer = category?.bufferMinutes || 0;

  const sameCategory = allAppointments.filter((a) => a.categoryId === categoryId);

  for (const app of sameCategory) {
    const appBuffer = app.bufferMinutes ?? buffer;
    const blockEnd = app.endMin + appBuffer;
    if (slotStart < blockEnd && slotEnd > app.startMin) return true;
  }
  return false;
}

/**
 * Count same-category appointments starting in same clock hour
 */
function countCategoryInHour(slotHHMM, categoryId, allAppointments) {
  const hour = getClockHour(slotHHMM);
  return allAppointments.filter(
    (a) => a.categoryId === categoryId && Math.floor(a.startMin / 60) === hour
  ).length;
}

/**
 * Check if user already has appointment in same clock hour
 */
function userHasAppointmentInHour(slotHHMM, userAppointments) {
  const hour = getClockHour(slotHHMM);
  return userAppointments.some((a) => Math.floor(a.startMin / 60) === hour);
}

// --------------- Command handlers ---------------

/**
 * [QUERY_CATEGORIES]
 * Returns user-friendly numbered list only (no IDs). Stores mapping for category_number in QUERY_AVAILABILITY / BOOK_APPOINTMENT.
 */
async function handleQueryCategories(context) {
  const categories = await loadCategories();
  if (categories.length === 0) return comment('noServicesAvailable');
  const phone = context.userId ? toPhoneKey(context.userId) : 'global';
  lastCategoriesByUser.set(phone, { list: categories.map((c) => ({ id: c.id, name: c.name })) });
  return categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
}

/**
 * [QUERY_TREATMENTS: category_number=N] or category_id=...
 * Returns user-friendly numbered list of treatment types for that category. Stores list for treatment_number in QUERY_AVAILABILITY / BOOK_APPOINTMENT.
 */
async function handleQueryTreatments(params, context) {
  let categoryId = (params.category_id || '').trim();
  const categoryNumber = params.category_number != null ? parseInt(String(params.category_number), 10) : NaN;

  if (!categoryId && (isNaN(categoryNumber) || categoryNumber < 1)) return comment('noServiceSelected');
  if (!categoryId) {
    const phone = context.userId ? toPhoneKey(context.userId) : 'global';
    const stored = lastCategoriesByUser.get(phone);
    if (stored?.list?.[categoryNumber - 1]) {
      categoryId = stored.list[categoryNumber - 1].id;
    } else {
      const allCategories = await loadCategories();
      if (Array.isArray(allCategories) && allCategories[categoryNumber - 1]) {
        categoryId = allCategories[categoryNumber - 1].id;
      } else {
        return comment('serviceNotFoundRestart');
      }
    }
  }

  const category = await getCategoryById(categoryId);
  if (!category) return comment('serviceNotFound');
  const treatments = category.treatments || [];
  if (treatments.length === 0) return comment('noTreatmentsAvailable');

  const phone = context.userId ? toPhoneKey(context.userId) : 'global';
  lastTreatmentsByUser.set(phone, {
    categoryId,
    list: treatments.map((t) => ({ id: t.id, name: t.name, durationMinutes: t.durationMinutes, bufferMinutes: t.bufferMinutes })),
  });
  return treatments.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
}

/**
 * [QUERY_AVAILABILITY: date=YYYY-MM-DD, category_id=... או category_number=1, preferred_time=HH:MM?]
 * Returns list of free slots. If preferred_time is set (מסלול מקוצר): returns "השעה X פנויה" or "השעה X תפוסה" + list.
 */
function normalizeTimeToHHMM(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const s = timeStr.trim();
  let t = parseTime(s);
  if (t == null && /^\d{1,2}$/.test(s)) {
    const h = parseInt(s, 10);
    if (h >= 0 && h <= 23) t = [h, 0];
  }
  if (t == null) return '';
  const [h, m] = t;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function handleQueryAvailability(params, context) {
  const dateStr = (params.date || '').trim();
  let categoryId = (params.category_id || '').trim();
  const categoryNumber = params.category_number != null ? parseInt(String(params.category_number), 10) : NaN;
  const treatmentNumber = params.treatment_number != null ? parseInt(String(params.treatment_number), 10) : NaN;
  const preferredTimeRaw = (params.preferred_time || '').trim();
  const preferredTime = preferredTimeRaw ? normalizeTimeToHHMM(preferredTimeRaw) : '';

  if (!dateStr) return comment('noDateProvided');
  if (!categoryId && (isNaN(categoryNumber) || categoryNumber < 1)) return comment('noServiceSelected');
  if (!categoryId) {
    const phone = context.userId ? toPhoneKey(context.userId) : 'global';
    let stored = lastCategoriesByUser.get(phone);
    if (stored?.list?.[categoryNumber - 1]) {
      categoryId = stored.list[categoryNumber - 1].id;
    } else {
      const allCategories = await loadCategories();
      if (Array.isArray(allCategories) && allCategories[categoryNumber - 1]) {
        categoryId = allCategories[categoryNumber - 1].id;
      } else {
        return comment('serviceNotFoundRestart');
      }
    }
  }

  const date = parseDateString(dateStr);
  if (!date) return comment('invalidDateFormat');

  const category = await getCategoryById(categoryId);
  if (!category) return comment('serviceNotFound');

  let duration = category.durationMinutes;
  let useTreatmentSlots = false;
  if (!isNaN(treatmentNumber) && treatmentNumber >= 1) {
    const phone = context.userId ? toPhoneKey(context.userId) : 'global';
    const treatmentStored = lastTreatmentsByUser.get(phone);
    if (treatmentStored && treatmentStored.categoryId === categoryId && treatmentStored.list?.[treatmentNumber - 1]) {
      const treatment = treatmentStored.list[treatmentNumber - 1];
      duration = treatment.durationMinutes;
      useTreatmentSlots = true;
    }
  }

  const phone = context.userId ? toPhoneKey(context.userId) : '';
  const businessHours = await loadBusinessHours();
  const dayIndex = date.getDay();
  const ranges = getHoursForDay(businessHours, dayIndex);

  const allSlots = useTreatmentSlots
    ? getCandidateStartTimesForDuration(ranges, duration)
    : generateSlotsForCategory(ranges, category);

  const reminders = await loadReminders();
  const categories = await loadCategories();
  const categoryBufferMap = Object.fromEntries(categories.map((c) => [c.id, c.bufferMinutes]));
  const allAppointments = getAllAppointmentsForDate(reminders, dateStr, categoryBufferMap);
  const userReminders = phone ? await getRemindersForUser(phone) : [];
  const userAppointments = getUserAppointmentsForDate(userReminders, dateStr);

  const now = getCurrentDate();
  const todayStr = formatDateString(now);
  const isToday = dateStr === todayStr;

  const freeSlots = [];
  for (const slot of allSlots) {
    if (isSlotBlockedByCategory(slot, duration, categoryId, allAppointments, category)) continue;
    if (countCategoryInHour(slot, categoryId, allAppointments) >= category.maxPerHour) continue;
    if (userHasAppointmentInHour(slot, userAppointments)) continue;

    if (isToday) {
      const [h, m] = parseTime(slot) || [0, 0];
      const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      if (slotDate <= now) continue;
    }

    const [h, m] = parseTime(slot) || [0, 0];
    const slotMin = h * 60 + m;
    let withinHours = false;
    for (const range of ranges) {
      const [startH, startM] = parseTime(range.start) || [0, 0];
      const [endH, endM] = parseTime(range.end) || [23, 59];
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      if (slotMin >= startMin && slotMin + duration <= endMin) {
        withinHours = true;
        break;
      }
    }
    if (!withinHours) continue;

    freeSlots.push(slot);
  }

  if (freeSlots.length === 0) return comment('noSlotsThatDate');
  if (preferredTime) {
    const isAvailable = freeSlots.includes(preferredTime);
    if (isAvailable) return comment('preferredTimeAvailable', { time: preferredTime });
    return comment('preferredTimeTaken', { time: preferredTime }) + '\n' + freeSlots.join('\n');
  }
  return freeSlots.join('\n');
}

/**
 * [BOOK_APPOINTMENT: date=..., time=..., category_id=... או category_number=1, treatment_number=M?]
 * Books a new appointment. If treatment_number is set, uses treatment duration and buffer and stores treatmentId.
 */
async function handleBookAppointment(params, context) {
  const dateStr = (params.date || '').trim();
  const timeStr = (params.time || '').trim();
  let categoryId = (params.category_id || '').trim();
  const categoryNumber = params.category_number != null ? parseInt(String(params.category_number), 10) : NaN;
  const treatmentNumber = params.treatment_number != null ? parseInt(String(params.treatment_number), 10) : NaN;

  if (!dateStr || !timeStr) return comment('missingDateOrTime');
  if (!categoryId && (isNaN(categoryNumber) || categoryNumber < 1)) return comment('noServiceSelected');
  if (!categoryId) {
    const phone = context.userId ? toPhoneKey(context.userId) : 'global';
    const stored = lastCategoriesByUser.get(phone);
    if (stored?.list?.[categoryNumber - 1]) {
      categoryId = stored.list[categoryNumber - 1].id;
    } else {
      const allCategories = await loadCategories();
      if (Array.isArray(allCategories) && allCategories[categoryNumber - 1]) {
        categoryId = allCategories[categoryNumber - 1].id;
      } else {
        return comment('serviceNotFoundRestart');
      }
    }
  }

  const date = parseDateString(dateStr);
  if (!date) return comment('invalidDate');
  const [h, m] = parseTime(timeStr);
  if (h === undefined) return comment('invalidTime');

  const category = await getCategoryById(categoryId);
  if (!category) return comment('serviceNotFound');

  const phone = context.userId ? toPhoneKey(context.userId) : '';
  if (!phone) return comment('cannotIdentifyUser');

  let duration = category.durationMinutes;
  let bufferMinutes = category.bufferMinutes;
  let treatmentId = null;
  let treatmentName = null;
  let useTreatmentSlots = false;
  if (!isNaN(treatmentNumber) && treatmentNumber >= 1) {
    const treatmentStored = lastTreatmentsByUser.get(phone);
    if (treatmentStored && treatmentStored.categoryId === categoryId && treatmentStored.list?.[treatmentNumber - 1]) {
      const treatment = treatmentStored.list[treatmentNumber - 1];
      duration = treatment.durationMinutes;
      bufferMinutes = treatment.bufferMinutes;
      treatmentId = treatment.id;
      treatmentName = treatment.name;
      useTreatmentSlots = true;
    }
  }

  const slotMin = h * 60 + m;

  const reminders = await loadReminders();
  const categories = await loadCategories();
  const categoryBufferMap = Object.fromEntries(categories.map((c) => [c.id, c.bufferMinutes]));
  const allAppointments = getAllAppointmentsForDate(reminders, dateStr, categoryBufferMap);
  const userReminders = await getRemindersForUser(phone);
  const userAppointments = getUserAppointmentsForDate(userReminders, dateStr);

  if (isSlotBlockedByCategory(timeStr, duration, categoryId, allAppointments, category)) {
    return comment('slotTaken');
  }
  if (countCategoryInHour(timeStr, categoryId, allAppointments) >= category.maxPerHour) {
    return comment('noRoomThisHour');
  }
  if (userHasAppointmentInHour(timeStr, userAppointments)) {
    return comment('alreadyHaveAppointmentThisHour');
  }

  const businessHours = await loadBusinessHours();
  const dayIndex = date.getDay();
  const ranges = getHoursForDay(businessHours, dayIndex);
  let withinHours = false;
  for (const range of ranges) {
    const [startH, startM] = parseTime(range.start) || [0, 0];
    const [endH, endM] = parseTime(range.end) || [23, 59];
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    if (slotMin >= startMin && slotMin + duration <= endMin) {
      withinHours = true;
      break;
    }
  }
  if (!withinHours) return comment('outsideBusinessHours');

  const validSlots = useTreatmentSlots
    ? getCandidateStartTimesForDuration(ranges, duration)
    : generateSlotsForCategory(ranges, category);
  if (!validSlots.includes(timeStr)) {
    return comment('timeNotInList');
  }

  const freshReminders = await getRemindersForUser(phone);
  const freshUserAppointments = getUserAppointmentsForDate(freshReminders, dateStr);
  const freshAllReminders = await loadReminders();
  const freshAllAppointments = getAllAppointmentsForDate(freshAllReminders, dateStr, categoryBufferMap);

  if (isSlotBlockedByCategory(timeStr, duration, categoryId, freshAllAppointments, category)) {
    return comment('slotTakenNow');
  }
  if (userHasAppointmentInHour(timeStr, freshUserAppointments)) {
    return comment('alreadyHaveAppointmentThisHour');
  }

  const validDuration = Math.max(1, Math.round(duration || 30));

  const clientDisplayName = await getClientDisplayName(phone);
  const serviceLabel = treatmentName ? `${category.name} - ${treatmentName}` : (category.name || 'פגישה');
  const titleForCalendar = clientDisplayName
    ? `פגישה - ${clientDisplayName} - ${serviceLabel}`
    : `פגישה - ${serviceLabel}`;

  const id = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const newReminder = {
    id,
    date: dateStr,
    time: timeStr,
    day: getDayName(dayIndex),
    type: 'one-time',
    title: titleForCalendar,
    duration: validDuration,
    categoryId: category.id,
    preReminder: DEFAULT_PRE_REMINDERS,
  };
  if (treatmentId) newReminder.treatmentId = treatmentId;
  if (bufferMinutes != null) newReminder.bufferMinutes = bufferMinutes;

  const remindersBefore = [...freshReminders];
  freshReminders.push(newReminder);
  await updateRemindersForUser(phone, freshReminders);

  const { syncUserRemindersToGoogleCalendar } = await import('./googleCalendarSyncService.js');
  syncUserRemindersToGoogleCalendar(phone, remindersBefore, freshReminders).catch((err) => {
    logError(`[AI Middleware] Google Calendar sync after BOOK_APPOINTMENT: ${err?.message || err}`);
  });

  logInfo(`[AI Middleware] BOOK_APPOINTMENT: created ${id} for ${phone} at ${dateStr} ${timeStr} (${serviceLabel})`);
  const dateDisplay = formatDateShort(dateStr);
  const successMsg = comment('bookSuccess', { dateDisplay, timeStr, categoryName: serviceLabel });
  return { replacement: successMsg, stopConversation: true };
}

/**
 * [CANCEL_APPOINTMENT: appointment_id=... או number=1]
 * number= מתייחס לרשימת התורים מהקריאה האחרונה ל-[LIST_APPOINTMENTS].
 */
async function handleCancelAppointment(params, context) {
  let appointmentId = (params.appointment_id || '').trim();
  const numberParam = params.number != null ? parseInt(String(params.number), 10) : NaN;

  if (!appointmentId && (isNaN(numberParam) || numberParam < 1)) {
    return comment('cancelNoNumber');
  }
  if (!appointmentId) {
    const phone = context.userId ? toPhoneKey(context.userId) : '';
    if (!phone) return comment('cannotIdentifyUser');
    const stored = lastAppointmentsListByUser.get(phone);
    if (!stored || !stored.list || !stored.list[numberParam - 1]) {
      return comment('cancelAppointmentNotFound');
    }
    appointmentId = stored.list[numberParam - 1].id;
  }

  const found = await findReminderById(appointmentId);
  if (!found) return comment('appointmentNotFoundOrCancelled');

  const eventId = found.reminder?.googleCalendarEventId;
  const reminders = await loadReminders();
  const userReminders = (reminders[found.phoneNumber] || []).filter((r) => r.id !== appointmentId);
  reminders[found.phoneNumber] = userReminders;
  await saveReminders(reminders);

  if (eventId) {
    const { deleteReminderEventFromCalendar } = await import('./googleCalendarSyncService.js');
    deleteReminderEventFromCalendar(eventId).catch((err) => {
      logError(`[AI Middleware] Google Calendar delete after CANCEL_APPOINTMENT: ${err?.message || err}`);
    });
  }

  logInfo(`[AI Middleware] CANCEL_APPOINTMENT: removed ${appointmentId}`);
  return comment('cancelSuccess');
}

/**
 * [LIST_APPOINTMENTS] or [LIST_APPOINTMENTS: user_id=...]
 * Returns user-friendly list only (no IDs). Stores list for CANCEL_APPOINTMENT number=.
 */
async function handleListAppointments(params, context) {
  const userIdParam = (params.user_id || '').trim();
  const phone = userIdParam ? toPhoneKey(userIdParam) : (context.userId ? toPhoneKey(context.userId) : '');
  if (!phone) return comment('listCannotDisplay');

  const userReminders = await getRemindersForUser(phone);
  const todayStr = formatDateString(getCurrentDate());
  const future = userReminders
    .filter((r) => r.date && r.date >= todayStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    });

  if (future.length === 0) return comment('noFutureAppointments');
  lastAppointmentsListByUser.set(phone, { list: future });
  return future
    .map((r, i) => `${i + 1}. ${formatDateShort(r.date)} בשעה ${r.time || '--:--'}${r.title ? ' – ' + r.title : ''}`)
    .join('\n');
}

/**
 * [ABORT_BOOKING]
 */
function handleAbortBooking(context) {
  const key = context.userId || 'global';
  if (bookingTempState.has(key)) {
    bookingTempState.delete(key);
    logInfo(`[AI Middleware] ABORT_BOOKING: cleared temp state for ${key}`);
  }
  lastCategoriesByUser.delete(key);
  lastTreatmentsByUser.delete(key);
  return comment('abortBooking');
}

// --------------- Regex patterns ---------------

const COMMAND_PATTERNS = [
  {
    name: 'QUERY_CATEGORIES',
    regex: /\[QUERY_CATEGORIES(?:\s*:\s*([^\]]*))?\]/gi,
    handler: handleQueryCategories,
    parseParams: () => ({}),
  },
  {
    name: 'QUERY_TREATMENTS',
    regex: /\[QUERY_TREATMENTS(?:\s*:\s*([^\]]*))?\]/gi,
    handler: handleQueryTreatments,
    parseParams: (body) => parseCommandParams(body || ''),
  },
  {
    name: 'QUERY_AVAILABILITY',
    regex: /\[QUERY_AVAILABILITY:\s*([^\]]*)\]/gi,
    handler: handleQueryAvailability,
    parseParams: (body) => parseCommandParams(body),
  },
  {
    name: 'BOOK_APPOINTMENT',
    regex: /\[BOOK_APPOINTMENT:\s*([^\]]*)\]/gi,
    handler: handleBookAppointment,
    parseParams: parseCommandParams,
  },
  {
    name: 'CANCEL_APPOINTMENT',
    regex: /\[CANCEL_APPOINTMENT:\s*([^\]]*)\]/gi,
    handler: handleCancelAppointment,
    parseParams: parseCommandParams,
  },
  {
    name: 'LIST_APPOINTMENTS',
    regex: /\[LIST_APPOINTMENTS(?:\s*:\s*([^\]]*))?\]/gi,
    handler: handleListAppointments,
    parseParams: (body) => parseCommandParams(body || ''),
  },
  {
    name: 'ABORT_BOOKING',
    regex: /\[ABORT_BOOKING\]/gi,
    handler: handleAbortBooking,
    parseParams: () => ({}),
  },
];

/**
 * Process AI response text: find all commands, run handlers, replace with results.
 * @returns {Promise<{text: string, stopConversation?: boolean}>} stopConversation true when BOOK_APPOINTMENT succeeded (caller should end conversation).
 */
export async function processAiResponse(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', stopConversation: false };
  }

  let result = text;
  let stopConversation = false;
  for (const { name, regex, handler, parseParams } of COMMAND_PATTERNS) {
    regex.lastIndex = 0;
    const matches = [...text.matchAll(regex)];
    for (const match of matches) {
      const fullMatch = match[0];
      const body = (match[1] || '').trim();
      try {
        const params = parseParams(body);
        const raw = await Promise.resolve(handler(params, context));
        const replacement =
          typeof raw === 'object' && raw != null && 'replacement' in raw
            ? String(raw.replacement)
            : String(raw);
        if (typeof raw === 'object' && raw != null && raw.stopConversation) {
          stopConversation = true;
        }
        result = result.replace(fullMatch, replacement);
      } catch (err) {
        logError(`[AI Middleware] Error executing ${name}:`, err);
        result = result.replace(fullMatch, comment('middlewareError'));
      }
    }
  }
  return { text: result, stopConversation };
}
