/**
 * Sync reminders (meetings) to Google Calendar.
 * Only reminders with type === 'recurring' (קבועה) become recurring events; all others are one-time events.
 */

import { getCalendarClient, isConnected } from './googleCalendarAuthService.js';
import { patchReminderFields } from './reminderService.js';
import { getDayIndex, getNextDayOfWeek, getCurrentDate, parseTime, parseDateString, formatDateString } from '../utils/dateUtils.js';
import { logError, logInfo } from '../utils/logger.js';

const CALENDAR_ID = 'primary';
const TIMEZONE = 'Asia/Jerusalem';
const BYDAY_MAP = { 'ראשון': 'SU', 'שני': 'MO', 'שלישי': 'TU', 'רביעי': 'WE', 'חמישי': 'TH', 'שישי': 'FR', 'שבת': 'SA' };

/**
 * Build ISO date-time for Israel (no timezone in API = use local).
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:MM
 * @param {number} durationMinutes
 * @returns {{ start: string, end: string }}
 */
function toStartEnd(dateStr, timeStr, durationMinutes = 30) {
  const [h, m] = parseTime(timeStr) || [9, 0];
  const start = new Date(dateStr);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

/**
 * Build event body for one-time reminder (has date).
 * @param {Object} reminder - reminder object
 * @param {string} [title] - optional override
 * @returns {Object} Calendar API event resource
 */
function eventFromOneTimeReminder(reminder, title) {
  const summary = title || reminder.title || 'פגישה';
  const duration = Math.max(15, Number(reminder.duration) || 30);
  const { start, end } = toStartEnd(reminder.date, reminder.time, duration);
  return {
    summary,
    start: { dateTime: start, timeZone: TIMEZONE },
    end: { dateTime: end, timeZone: TIMEZONE }
  };
}

/**
 * Build event body for recurring reminder (day of week) – only for type === 'recurring'.
 * @param {Object} reminder - reminder object
 * @param {string} [title] - optional override
 * @returns {Object} Calendar API event resource
 */
function eventFromRecurringReminder(reminder, title) {
  const summary = title || reminder.title || 'פגישה';
  const duration = Math.max(15, Number(reminder.duration) || 30);
  const byday = BYDAY_MAP[reminder.day];
  if (!byday) {
    throw new Error(`Invalid day for recurrence: ${reminder.day}`);
  }
  const today = getCurrentDate();
  const dayIndex = getDayIndex(reminder.day);
  const firstStart = getNextDayOfWeek(today, dayIndex);
  firstStart.setHours(...(parseTime(reminder.time) || [9, 0]), 0, 0);
  const firstEnd = new Date(firstStart.getTime() + duration * 60 * 1000);
  return {
    summary,
    start: { dateTime: firstStart.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: firstEnd.toISOString(), timeZone: TIMEZONE },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday}`]
  };
}

/**
 * Build one-time event for reminder that has day+time but is not recurring (e.g. one-time by day).
 * Uses next occurrence of that day or mainReminderStatus.scheduledFor if set.
 */
function eventFromOneTimeWithDay(reminder, title) {
  const summary = title || reminder.title || 'פגישה';
  const duration = Math.max(15, Number(reminder.duration) || 30);
  let firstStart;
  const scheduledFor = reminder.mainReminderStatus?.scheduledFor;
  if (scheduledFor) {
    firstStart = new Date(scheduledFor);
    firstStart.setHours(...(parseTime(reminder.time) || [9, 0]), 0, 0);
  } else {
    const today = getCurrentDate();
    const dayIndex = getDayIndex(reminder.day);
    firstStart = getNextDayOfWeek(today, dayIndex);
    firstStart.setHours(...(parseTime(reminder.time) || [9, 0]), 0, 0);
  }
  const firstEnd = new Date(firstStart.getTime() + duration * 60 * 1000);
  return {
    summary,
    start: { dateTime: firstStart.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: firstEnd.toISOString(), timeZone: TIMEZONE }
  };
}

/**
 * Build event resource for any reminder.
 * Recurring in Google only when type === 'recurring' (קבועה); otherwise one-time.
 */
function reminderToEventBody(reminder) {
  const summary = reminder.title || 'פגישה';
  if (reminder.date) {
    return eventFromOneTimeReminder(reminder, summary);
  }
  if (reminder.day && reminder.time) {
    if (reminder.type === 'recurring') {
      return eventFromRecurringReminder(reminder, summary);
    }
    return eventFromOneTimeWithDay(reminder, summary);
  }
  return null;
}

/**
 * Create event in Google Calendar and return event id.
 * @param {Object} reminder - reminder object (date or day+time)
 * @returns {Promise<string|null>} event id or null
 */
async function createCalendarEvent(reminder) {
  const client = await getCalendarClient();
  if (!client) return null;
  const body = reminderToEventBody(reminder);
  if (!body) return null;
  try {
    const res = await client.calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: body
    });
    return res.data.id || null;
  } catch (e) {
    logError(`Google Calendar create event: ${e.message}`);
    return null;
  }
}

/**
 * Update existing event.
 * @param {string} eventId
 * @param {Object} reminder - updated reminder
 * @returns {Promise<boolean>}
 */
async function updateCalendarEvent(eventId, reminder) {
  const client = await getCalendarClient();
  if (!client) return false;
  const body = reminderToEventBody(reminder);
  if (!body) return false;
  try {
    await client.calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: body
    });
    return true;
  } catch (e) {
    logError(`Google Calendar update event ${eventId}: ${e.message}`);
    return false;
  }
}

/**
 * Delete event from calendar.
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
async function deleteCalendarEvent(eventId) {
  const client = await getCalendarClient();
  if (!client) return false;
  try {
    await client.calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId
    });
    return true;
  } catch (e) {
    if (e.code !== 404) logError(`Google Calendar delete event ${eventId}: ${e.message}`);
    return false;
  }
}

/**
 * Sync user reminders to Google Calendar: create new, update changed, delete removed.
 * @param {string} phone - user phone
 * @param {Array} oldList - previous reminders (to detect deletes and carry googleCalendarEventId)
 * @param {Array} newList - current reminders after save
 */
export async function syncUserRemindersToGoogleCalendar(phone, oldList, newList) {
  if (!(await isConnected(true))) return;

  const oldById = new Map((oldList || []).map((r) => [r.id, r]));
  const newById = new Map((newList || []).map((r) => [r.id, r]));

  // Removed: delete from calendar
  for (const r of oldList || []) {
    if (!newById.has(r.id) && r.googleCalendarEventId) {
      await deleteCalendarEvent(r.googleCalendarEventId);
      logInfo(`Google Calendar: deleted event for reminder ${r.id}`);
    }
  }

  for (const r of newList || []) {
    const body = reminderToEventBody(r);
    if (!body) continue;

    const existing = oldById.get(r.id);
    const eventId = r.googleCalendarEventId || (existing && existing.googleCalendarEventId);

    if (!eventId) {
      const id = await createCalendarEvent(r);
      if (id) {
        await patchReminderFields(phone, r.id, { googleCalendarEventId: id });
        logInfo(`Google Calendar: created event for reminder ${r.id}`);
      }
    } else {
      const changed =
        !existing ||
        existing.date !== r.date ||
        existing.time !== r.time ||
        (existing.title || '') !== (r.title || '') ||
        (existing.day || '') !== (r.day || '') ||
        (existing.duration || 0) !== (r.duration || 0);
      if (changed) {
        const ok = await updateCalendarEvent(eventId, r);
        if (ok) logInfo(`Google Calendar: updated event for reminder ${r.id}`);
      }
    }
  }
}

/**
 * Delete a single reminder's event (e.g. after CANCEL_APPOINTMENT).
 * @param {string} eventId - googleCalendarEventId from the reminder
 */
export async function deleteReminderEventFromCalendar(eventId) {
  if (!eventId) return;
  if (!(await isConnected(true))) return;
  await deleteCalendarEvent(eventId);
}
