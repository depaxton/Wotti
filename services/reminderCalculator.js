// Reminder Calculator Service
// Calculates next occurrence dates for reminders and pre-reminders

import { 
  getDayIndex, 
  parseTime, 
  getNextDayOfWeek, 
  getCurrentDate, 
  addInterval,
  isPast,
  formatDateString,
  getWeekStart,
  isSameWeek,
  parseDateString
} from '../utils/dateUtils.js';
import { logError, logInfo } from '../utils/logger.js';

/**
 * Calculates the next occurrence date for a reminder
 * @param {string} day - Hebrew day name (e.g., "חמישי")
 * @param {string} time - Time string (e.g., "10:00")
 * @param {string} type - Reminder type ("one-time" or "recurring")
 * @param {Object} recurringStatus - Recurring status object (for recurring reminders)
 * @returns {Date|null} Next occurrence date or null if invalid
 */
export function calculateNextOccurrence(day, time, type = 'one-time', recurringStatus = {}) {
  const dayIndex = getDayIndex(day);
  if (dayIndex === null) {
    logError(`Invalid day name: ${day}`);
    return null;
  }
  
  const timeParts = parseTime(time);
  if (!timeParts) {
    logError(`Invalid time format: ${time}`);
    return null;
  }
  
  const [hour, minute] = timeParts;
  const now = getCurrentDate();
  
  // For recurring reminders, check if already sent this week
  if (type === 'recurring' && recurringStatus?.lastSentWeek) {
    const lastSentWeek = parseDateString(recurringStatus.lastSentWeek);
    if (lastSentWeek && isSameWeek(now, lastSentWeek)) {
      // Already sent this week, return next week's occurrence
      const nextWeekDate = getNextDayOfWeek(now, dayIndex);
      nextWeekDate.setHours(hour, minute, 0, 0);
      
      // Make sure it's next week (add 7 days if same day)
      const currentDay = now.getDay();
      if (currentDay === dayIndex) {
        const todayTime = new Date(now);
        todayTime.setHours(hour, minute, 0, 0);
        if (todayTime <= now) {
          nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        }
      } else if (nextWeekDate <= now) {
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      }
      
      return nextWeekDate;
    }
  }
  
  // Calculate next occurrence (could be today if same day)
  let nextDate = getNextDayOfWeek(now, dayIndex);
  nextDate.setHours(hour, minute, 0, 0);
  
  // If the calculated date is in the past (same day but time passed), move to next week
  // Use a small margin (1 minute) to handle edge cases where reminder is created just before time
  const margin = 60000; // 1 minute
  if (nextDate.getTime() < (now.getTime() - margin)) {
    nextDate.setDate(nextDate.getDate() + 7);
  }
  
  return nextDate;
}

/**
 * Calculates scheduled times for all pre-reminders and main reminder
 * @param {Object} reminder - Reminder object
 * @returns {Object} Object with scheduledFor times for each reminder type
 */
export function calculateAllScheduledTimes(reminder) {
  if (!reminder || !reminder.time) {
    return null;
  }
  
  let mainTime = null;
  
  // Handle specific date (new format)
  if (reminder.date) {
    const dateObj = parseDateString(reminder.date);
    if (!dateObj) {
      return null;
    }
    
    // Parse time
    const timeParts = parseTime(reminder.time);
    if (!timeParts) {
      return null;
    }
    
    const [hour, minute] = timeParts;
    mainTime = new Date(dateObj);
    mainTime.setHours(hour, minute, 0, 0);
    
    // For one-time reminders with specific date, if time has passed, don't schedule
    if (reminder.type === 'one-time' && isPast(mainTime, 300)) {
      // More than 5 minutes in the past, don't schedule
      return null;
    }
  } 
  // Handle day of week (old format)
  else if (reminder.day) {
    mainTime = calculateNextOccurrence(
      reminder.day, 
      reminder.time, 
      reminder.type || 'one-time',
      reminder.recurringStatus || {}
    );
    
    if (!mainTime) {
      return null;
    }
  } else {
    // Neither day nor date provided
    return null;
  }
  
  const result = {
    main: mainTime,
    preReminders: {}
  };
  
  // Calculate pre-reminder times
  if (Array.isArray(reminder.preReminder)) {
    for (const preReminder of reminder.preReminder) {
      const preTime = addInterval(mainTime, preReminder);
      if (preTime) {
        result.preReminders[preReminder] = preTime;
      }
    }
  }
  
  return result;
}

/**
 * Finds the closest unsent pre-reminder to current time
 * Returns the pre-reminder closest to the meeting time (main reminder time) that hasn't been sent yet
 * Only returns a pre-reminder if main time hasn't passed
 * @param {Object} reminder - Reminder object
 * @param {Object} scheduledTimes - Scheduled times object
 * @returns {Object|null} {type, scheduledFor} or null
 */
export function findClosestPreReminder(reminder, scheduledTimes) {
  const now = getCurrentDate();
  const mainTime = scheduledTimes.main;
  
  // If main time has passed, don't send any pre-reminders
  if (mainTime <= now) {
    return null;
  }
  
  // Find closest unsent pre-reminder (closest to main time, not necessarily to now)
  let closestPreReminder = null;
  let closestTime = null;
  let closestType = null;
  
  if (Array.isArray(reminder.preReminder) && scheduledTimes.preReminders) {
    for (const preReminderType of reminder.preReminder) {
      const scheduledFor = scheduledTimes.preReminders[preReminderType];
      
      if (!scheduledFor) {
        continue;
      }
      
      // Check if already sent
      const status = reminder.preReminderStatus?.[preReminderType] || {};
      if (status.sent === true) {
        continue;
      }
      
      // Only consider pre-reminders that are due NOW (within time window).
      // Do not send "catch-up" for past pre-reminders (e.g. don't send 3d/1d when meeting is in 1h).
      const windowMs = 30 * 1000; // 30 seconds
      const scheduledMs = scheduledFor.getTime();
      const nowMs = now.getTime();
      const isInWindow = scheduledMs >= nowMs - windowMs && scheduledMs <= nowMs + windowMs;
      
      if (isInWindow && scheduledFor < mainTime) {
        // Find the one closest to main time (latest scheduled time)
        if (!closestTime || scheduledFor > closestTime) {
          closestTime = scheduledFor;
          closestType = preReminderType;
        }
      }
    }
  }
  
  if (closestType && closestTime) {
    return {
      type: closestType,
      scheduledFor: closestTime
    };
  }
  
  return null;
}

/**
 * Checks if a reminder should be sent (not past and not already sent)
 * @param {Object} reminder - Reminder object
 * @param {Date} scheduledFor - Scheduled time
 * @param {string} reminderType - Type: 'main' or pre-reminder key like '30m', '1h', '1d'
 * @returns {boolean} True if should send
 */
export function shouldSendReminder(reminder, scheduledFor, reminderType = 'main') {
  if (!scheduledFor || !(scheduledFor instanceof Date)) {
    return false;
  }
  
  const now = getCurrentDate();
  const nowMs = now.getTime();
  const scheduledMs = scheduledFor.getTime();
  
  // Get main reminder time to check if it has passed
  const mainScheduledFor = reminder.mainReminderStatus?.scheduledFor 
    ? new Date(reminder.mainReminderStatus.scheduledFor)
    : null;
  
  // If main reminder time has passed, don't send anything (neither main nor pre-reminders)
  if (mainScheduledFor && mainScheduledFor < now) {
    return false;
  }
  
  const windowMs = 30000; // 30 seconds in each direction
  
  // Check status
  if (reminderType === 'main') {
    const status = reminder.mainReminderStatus || {};
    // Don't send if already sent successfully
    if (status.sent === true) {
      return false;
    }
    // Don't send if skipped
    if (status.skipped === true) {
      return false;
    }
    // Send if scheduled time is within the window (past 30 seconds or next 30 seconds)
    // This allows catching reminders that were created just before their time
    return scheduledMs >= (nowMs - windowMs) && scheduledMs <= (nowMs + windowMs);
  } else {
    // Pre-reminder
    const status = reminder.preReminderStatus?.[reminderType] || {};
    // Don't send if already sent successfully
    if (status.sent === true) {
      return false;
    }
    // Don't send if skipped (but only if main time has also passed)
    // If main time hasn't passed yet, we should still try to send pre-reminders
    if (status.skipped === true) {
      // Only honor skipped if main time has passed
      if (mainScheduledFor && mainScheduledFor < now) {
        return false;
      }
      // Main time hasn't passed - allow sending even if previously skipped
      // (This can happen if reminder was initialized when main time was far away)
    }
    // Don't send if failed permanently (5 retries)
    if (status.failed === true && status.retries >= 5) {
      return false;
    }
    
    // For pre-reminders: send only when the scheduled time is due NOW (within window).
    // Do not send past-due pre-reminders (e.g. if meeting is in 1h, don't send 3d or 1d).
    if (mainScheduledFor && mainScheduledFor > now) {
      return scheduledMs >= (nowMs - windowMs) && scheduledMs <= (nowMs + windowMs);
    }
    
    // Main time passed or not available - use same strict window
    return scheduledMs >= (nowMs - windowMs) && scheduledMs <= (nowMs + windowMs);
  }
}

/**
 * Checks if a reminder needs retry (failed but not permanently)
 * @param {Object} reminder - Reminder object
 * @param {string} reminderType - Type: 'main' or pre-reminder key
 * @returns {boolean} True if needs retry
 */
export function needsRetry(reminder, reminderType = 'main') {
  if (reminderType === 'main') {
    const status = reminder.mainReminderStatus || {};
    // Needs retry if failed, has retries < 5, and last attempt was > 1 minute ago
    if (status.failed === true && status.retries < 5) {
      if (!status.lastAttempt) {
        return true; // Never attempted, should retry
      }
      const lastAttempt = new Date(status.lastAttempt);
      const now = getCurrentDate();
      const minutesSinceAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60);
      return minutesSinceAttempt >= 1;
    }
    return false;
  } else {
    // Pre-reminder
    const status = reminder.preReminderStatus?.[reminderType] || {};
    if (status.failed === true && status.retries < 5) {
      if (!status.lastAttempt) {
        return true;
      }
      const lastAttempt = new Date(status.lastAttempt);
      const now = getCurrentDate();
      const minutesSinceAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60);
      return minutesSinceAttempt >= 1;
    }
    return false;
  }
}

/**
 * Initializes status fields for a new reminder or resets them for updated reminder
 * @param {Object} reminder - Reminder object
 * @returns {Object} Reminder with initialized/reset status
 */
export function initializeReminderStatus(reminder) {
  const now = getCurrentDate();
  
  // Calculate all scheduled times
  const scheduledTimes = calculateAllScheduledTimes(reminder);
  if (!scheduledTimes) {
    return reminder; // Can't calculate, return as-is
  }
  
  // Initialize pre-reminder statuses
  const preReminderStatus = {};
  const mainTime = scheduledTimes.main;
  const mainTimePassed = isPast(mainTime, 300); // Check if main time passed more than 5 minutes ago
  
  if (Array.isArray(reminder.preReminder)) {
    for (const preReminder of reminder.preReminder) {
      const scheduledFor = scheduledTimes.preReminders[preReminder];
      
      if (!scheduledFor) {
        continue;
      }
      
      const preReminderPassed = isPast(scheduledFor, 300); // more than 5 min ago
      
      if (mainTimePassed && preReminderPassed) {
        // Main time passed and pre-reminder also passed - skip it
        preReminderStatus[preReminder] = {
          sent: false,
          skipped: true,
          scheduledFor: scheduledFor.toISOString()
        };
      } else if (!mainTimePassed && preReminderPassed) {
        // Main time hasn't passed but this pre-reminder time has (e.g. meeting in 1h, but 3d/1d are in the past)
        // Mark as skipped so we only send the relevant pre-reminder (e.g. 1h)
        preReminderStatus[preReminder] = {
          sent: false,
          skipped: true,
          scheduledFor: scheduledFor.toISOString()
        };
      } else {
        // Pre-reminder is due in the future - will be sent when its time comes
        preReminderStatus[preReminder] = {
          sent: false,
          failed: false,
          retries: 0,
          scheduledFor: scheduledFor.toISOString()
        };
      }
    }
  }
  
  // Initialize main reminder status
  const mainReminderStatus = {
    sent: false,
    failed: false,
    retries: 0,
    scheduledFor: scheduledTimes.main.toISOString()
  };
  
  // If main time is more than 5 minutes in the past, mark as skipped
  // Otherwise, still try to send (might be just a few seconds/minutes late)
  if (isPast(scheduledTimes.main, 300)) { // 5 minutes
    mainReminderStatus.skipped = true;
  }
  
  // Initialize recurring status if needed
  let recurringStatus = reminder.recurringStatus || {};
  if (reminder.type === 'recurring') {
    // Don't reset lastSentWeek if it exists (preserve history)
    if (!recurringStatus.lastSentWeek) {
      recurringStatus = {};
    }
  }
  
  return {
    ...reminder,
    preReminderStatus,
    mainReminderStatus,
    recurringStatus
  };
}

/**
 * Updates reminder status after sending (success)
 * @param {Object} reminder - Reminder object
 * @param {string} reminderType - Type: 'main' or pre-reminder key
 * @returns {Object} Updated reminder
 */
export function markReminderAsSent(reminder, reminderType = 'main') {
  const now = getCurrentDate();
  
  if (reminderType === 'main') {
    return {
      ...reminder,
      mainReminderStatus: {
        ...reminder.mainReminderStatus,
        sent: true,
        sentAt: now.toISOString(),
        failed: false
      },
      // For recurring, update lastSentWeek
      recurringStatus: reminder.type === 'recurring' ? {
        ...reminder.recurringStatus,
        lastSentWeek: formatDateString(getWeekStart(now))
      } : reminder.recurringStatus
    };
  } else {
    // Pre-reminder
    const preReminderStatus = { ...reminder.preReminderStatus };
    preReminderStatus[reminderType] = {
      ...preReminderStatus[reminderType],
      sent: true,
      sentAt: now.toISOString(),
      failed: false
    };
    
    return {
      ...reminder,
      preReminderStatus
    };
  }
}

/**
 * Updates reminder status after failed send
 * @param {Object} reminder - Reminder object
 * @param {string} reminderType - Type: 'main' or pre-reminder key
 * @param {Error} error - Error object
 * @returns {Object} Updated reminder
 */
export function markReminderAsFailed(reminder, reminderType = 'main', error = null) {
  const now = getCurrentDate();
  
  if (reminderType === 'main') {
    const currentRetries = (reminder.mainReminderStatus?.retries || 0) + 1;
    const failedPermanently = currentRetries >= 5;
    
    return {
      ...reminder,
      mainReminderStatus: {
        ...reminder.mainReminderStatus,
        sent: false,
        failed: failedPermanently,
        retries: currentRetries,
        lastAttempt: now.toISOString(),
        lastError: error?.message || 'Unknown error'
      }
    };
  } else {
    // Pre-reminder
    const preReminderStatus = { ...reminder.preReminderStatus };
    const currentStatus = preReminderStatus[reminderType] || {};
    const currentRetries = (currentStatus.retries || 0) + 1;
    const failedPermanently = currentRetries >= 5;
    
    preReminderStatus[reminderType] = {
      ...currentStatus,
      sent: false,
      failed: failedPermanently,
      retries: currentRetries,
      lastAttempt: now.toISOString(),
      lastError: error?.message || 'Unknown error'
    };
    
    return {
      ...reminder,
      preReminderStatus
    };
  }
}

/**
 * Checks if a one-time reminder should be deleted (meeting time passed by at least 3 minutes)
 * @param {Object} reminder - Reminder object
 * @returns {boolean} True if reminder should be deleted
 */
export function shouldDeleteReminder(reminder) {
  // Only delete one-time reminders (not recurring)
  if (reminder.type !== 'one-time') {
    return false;
  }
  
  // Check if main reminder status has scheduledFor time
  const scheduledFor = reminder.mainReminderStatus?.scheduledFor;
  if (!scheduledFor) {
    return false; // Can't determine meeting time, don't delete
  }
  
  const meetingTime = new Date(scheduledFor);
  const now = getCurrentDate();
  
  // Check if meeting time has passed by at least 3 minutes (180 seconds)
  const threeMinutesInMs = 3 * 60 * 1000;
  const timeSinceMeeting = now.getTime() - meetingTime.getTime();
  
  return timeSinceMeeting >= threeMinutesInMs;
}

