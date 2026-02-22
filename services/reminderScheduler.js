// Reminder Scheduler Service
// Main service that schedules and sends reminders automatically

import { getAllReminders, updateReminderStatus, updateRemindersForUser } from './reminderService.js';
import { getAllUsers } from './userService.js';
import { getClient, isClientReady } from './whatsappClient.js';
import { loadReminderTemplate, formatReminderTemplate } from './serverReminderTemplateService.js';
import {
  calculateAllScheduledTimes,
  shouldSendReminder,
  needsRetry,
  initializeReminderStatus as initializeReminderStatusCalc,
  markReminderAsSent,
  markReminderAsFailed,
  shouldDeleteReminder,
  findClosestPreReminder
} from './reminderCalculator.js';
import { validateReminder, normalizeReminder, normalizeDuration } from '../utils/reminderValidation.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';
import { isWithinNext, isPast, getCurrentDate } from '../utils/dateUtils.js';

const CHECK_INTERVAL = 15000; // 15 seconds
const RETRY_CHECK_INTERVAL = 60000; // 1 minute for retries

let schedulerInterval = null;
let retryInterval = null;
let cleanupInterval = null;
let isRunning = false;

/**
 * Formats a WhatsApp phone number
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number for WhatsApp
 */
function formatWhatsAppPhone(phone) {
  let formattedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
  return `${formattedPhone}@c.us`;
}

/**
 * Sends a reminder message via WhatsApp
 * @param {Object} reminder - Reminder object
 * @param {string} phoneNumber - User's phone number
 * @param {string} userName - User's name
 * @param {string} reminderType - Type: 'main' or pre-reminder key ('30m', '1h', '1d')
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendReminderMessage(reminder, phoneNumber, userName, reminderType = 'main') {
  try {
    const client = getClient();
    if (!client) {
      throw new Error('WhatsApp client not initialized');
    }

    const ready = await isClientReady();
    if (!ready) {
      throw new Error('WhatsApp client not ready');
    }

    // Load and format template
    const template = await loadReminderTemplate();
    
    // Calculate date for template
    const now = new Date();
    const dateStr = now.toLocaleDateString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    // Format day/date for template
    let dayDisplay = '';
    if (reminder.date) {
      // Specific date: format as "יום X, DD/MM"
      const { formatDateMonthDay, getDayName, parseDateString } = await import('../utils/dateUtils.js');
      const dateObj = parseDateString(reminder.date);
      if (dateObj) {
        const dayName = getDayName(dateObj.getDay());
        const monthDay = formatDateMonthDay(reminder.date);
        dayDisplay = `יום ${dayName}, ${monthDay}`;
      } else {
        dayDisplay = reminder.date;
      }
    } else if (reminder.day) {
      // Day of week: format as "יום X, DD/MM" (next occurrence)
      const { formatDateMonthDay, getNextDayOfWeekFromToday } = await import('../utils/dateUtils.js');
      const nextDate = getNextDayOfWeekFromToday(reminder.day);
      if (nextDate) {
        const monthDay = formatDateMonthDay(nextDate);
        dayDisplay = `יום ${reminder.day}, ${monthDay}`;
      } else {
        dayDisplay = `יום ${reminder.day}`;
      }
    }

    // Determine what to include in message based on reminder type
    let messageText = formatReminderTemplate(template, {
      name: userName,
      day: dayDisplay,
      time: reminder.time,
      date: dateStr
    });

    // Resolve chat/LID like manual send (avoids "No LID for user" when sending via scheduler)
    const digitsOnly = String(phoneNumber).replace(/\D/g, '');
    const chatIdCUs = `${digitsOnly}@c.us`;
    const chatIdSNet = `${digitsOnly}@s.whatsapp.net`;

    let resolvedChat = null;
    let resolvedChatId = null;

    // 1) Prefer finding chat from existing list (uses the id WhatsApp already has, including LID)
    try {
      const chats = await client.getChats();
      const digitsWith972 = digitsOnly.startsWith('972') ? digitsOnly : `972${digitsOnly.replace(/^0/, '')}`;
      const digitsWithout972 = digitsOnly.replace(/^972/, '') || digitsOnly;
      for (const chat of chats) {
        if (chat.isGroup) continue;
        const idStr = chat.id?._serialized || chat.id?.toString?.() || '';
        const prefix = idStr.split('@')[0] || '';
        const prefixDigits = prefix.replace(/\D/g, '');
        const match = prefixDigits === digitsOnly ||
          prefixDigits === digitsWith972 ||
          prefixDigits === digitsWithout972 ||
          prefix === digitsOnly;
        if (match) {
          resolvedChat = chat;
          resolvedChatId = idStr;
          break;
        }
      }
    } catch (e) {
      logError('getChats failed in sendReminderMessage (scheduler):', e?.message || e);
    }

    // 2) If not in chats, try getContactLidAndPhone (may return LID for @c.us contacts)
    if (!resolvedChatId && typeof client.getContactLidAndPhone === 'function') {
      try {
        const results = await client.getContactLidAndPhone([chatIdCUs]);
        const first = results?.[0];
        if (first?.lid) resolvedChatId = first.lid;
        else if (first?.pn) resolvedChatId = first.pn;
      } catch (_) {
        // ignore
      }
    }

    if (!resolvedChatId) resolvedChatId = chatIdCUs;

    // Send: use chat object from getChats when available (avoids "No LID" from getChat by id)
    try {
      if (resolvedChat) {
        await resolvedChat.sendMessage(messageText);
      } else {
        await client.sendMessage(resolvedChatId, messageText);
      }
    } catch (sendErr) {
      if (sendErr?.message?.includes('No LID') && resolvedChatId === chatIdCUs) {
        try {
          await client.sendMessage(chatIdSNet, messageText);
        } catch (fallbackErr) {
          logError('Scheduler reminder fallback @s.whatsapp.net failed:', fallbackErr?.message || fallbackErr);
          throw sendErr;
        }
      } else {
        throw sendErr;
      }
    }

    logInfo(`Reminder sent successfully: ${reminderType} to ${phoneNumber} (reminder ID: ${reminder.id})`);
    return true;
  } catch (error) {
    logError(`Failed to send reminder ${reminderType} to ${phoneNumber} (reminder ID: ${reminder.id}):`, error);
    throw error;
  }
}

/**
 * Processes and sends a reminder if it's time
 * @param {Object} reminder - Reminder object
 * @param {string} phoneNumber - User's phone number
 * @param {string} userName - User's name
 * @param {string} reminderType - Type: 'main' or pre-reminder key
 * @param {Date} scheduledFor - Scheduled time
 * @returns {Promise<boolean>} True if processed (sent or skipped), false if not yet time
 */
async function processReminder(reminder, phoneNumber, userName, reminderType, scheduledFor) {
  // Check if should send
  if (!shouldSendReminder(reminder, scheduledFor, reminderType)) {
    return false; // Not time yet
  }

  try {
    // Try to send
    const success = await sendReminderMessage(reminder, phoneNumber, userName, reminderType);
    
    if (success) {
      // Mark as sent
      await updateReminderStatus(phoneNumber, reminder.id, (r) => 
        markReminderAsSent(r, reminderType)
      );
      return true;
    }
  } catch (error) {
    // Mark as failed (will retry later)
    await updateReminderStatus(phoneNumber, reminder.id, (r) => 
      markReminderAsFailed(r, reminderType, error)
    );
    
    // Log for toast notification (server-side logging for now)
    logWarn(`⚠️ REMINDER FAILED: Could not send ${reminderType} reminder to ${userName} (${phoneNumber}) - ${error.message}`);
    
    return false;
  }
  
  return false;
}

/**
 * Cleans up expired one-time reminders (meeting time passed by at least 1 hour)
 */
async function cleanupExpiredReminders() {
  try {
    const allReminders = await getAllReminders();
    let deletedCount = 0;
    
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) {
        continue;
      }
      
      // Filter out reminders that should be deleted
      const validReminders = userReminders.filter(reminder => {
        const shouldDelete = shouldDeleteReminder(reminder);
        if (shouldDelete) {
          logInfo(`Deleting expired reminder ${reminder.id} for user ${phoneNumber} (meeting time passed by at least 1 hour)`);
          deletedCount++;
        }
        return !shouldDelete;
      });
      
      // If any reminders were deleted, update the user's reminder list
      if (validReminders.length !== userReminders.length) {
        await updateRemindersForUser(phoneNumber, validReminders);
      }
    }
    
    if (deletedCount > 0) {
      logInfo(`Cleaned up ${deletedCount} expired reminder(s)`);
    }
  } catch (error) {
    logError('Error cleaning up expired reminders:', error);
  }
}

/**
 * Processes retries for failed reminders
 */
async function processRetries() {
  try {
    const allReminders = await getAllReminders();
    const users = await getAllUsers();
    
    const retryPromises = [];
    
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) {
        continue;
      }
      
      const user = users[phoneNumber];
      const userName = user?.name || phoneNumber;
      
      for (const reminder of userReminders) {
        // Validate reminder; if only duration is invalid, normalize and retry
        let toProcess = reminder;
        let validation = validateReminder(reminder);
        if (!validation.valid) {
          const onlyDurationError = validation.errors.length === 1 &&
            validation.errors[0] === 'Duration must be a number >= 15 and divisible by 15';
          if (onlyDurationError) {
            toProcess = { ...reminder, duration: normalizeDuration(reminder.duration) };
            validation = validateReminder(toProcess);
          }
        }
        if (!validation.valid) {
          logWarn(`Skipping invalid reminder ${reminder.id}: ${validation.errors.join(', ')}`);
          continue;
        }
        
        // No main-reminder send or retry – advance reminders only
        
        // Check pre-reminders for retry
        if (Array.isArray(toProcess.preReminder)) {
          for (const preReminder of toProcess.preReminder) {
            if (needsRetry(toProcess, preReminder)) {
              const status = toProcess.preReminderStatus?.[preReminder];
              const scheduledFor = status?.scheduledFor 
                ? new Date(status.scheduledFor)
                : null;
              
              if (scheduledFor && !isPast(scheduledFor, 30)) {
                retryPromises.push(
                  processReminder(toProcess, phoneNumber, userName, preReminder, scheduledFor)
                );
              }
            }
          }
        }
      }
    }
    
    // Process all retries in parallel
    if (retryPromises.length > 0) {
      await Promise.allSettled(retryPromises);
    }
  } catch (error) {
    logError('Error processing retries:', error);
  }
}

/**
 * Main scheduler loop - checks all reminders and sends if time
 */
async function schedulerLoop() {
  if (!isRunning) {
    return;
  }

  try {
    const allReminders = await getAllReminders();
    const users = await getAllUsers();
    
    const sendPromises = [];
    
    // Process all reminders
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) {
        continue;
      }
      
      const user = users[phoneNumber];
      const userName = user?.name || phoneNumber;
      
      for (const reminder of userReminders) {
        // Validate reminder; if only duration is invalid, normalize and retry
        let toProcess = reminder;
        let validation = validateReminder(reminder);
        if (!validation.valid) {
          const onlyDurationError = validation.errors.length === 1 &&
            validation.errors[0] === 'Duration must be a number >= 15 and divisible by 15';
          if (onlyDurationError) {
            toProcess = { ...reminder, duration: normalizeDuration(reminder.duration) };
            validation = validateReminder(toProcess);
          }
        }
        if (!validation.valid) {
          logWarn(`Skipping invalid reminder ${reminder.id}: ${validation.errors.join(', ')}`);
          continue;
        }
        
        // Calculate or get scheduled times
        let scheduledTimes = calculateAllScheduledTimes(toProcess);
        
        if (!scheduledTimes) {
          // If can't calculate, try to initialize status
          const initialized = initializeReminderStatusCalc(toProcess);
          scheduledTimes = calculateAllScheduledTimes(initialized);
          
          if (scheduledTimes) {
            // Update reminder with initialized status
            await updateReminderStatus(phoneNumber, toProcess.id, () => initialized);
          } else {
            logWarn(`Could not calculate scheduled times for reminder ${reminder.id}`);
            continue;
          }
        }
        
        const now = getCurrentDate();
        const mainTime = scheduledTimes.main;
        
        // If main time has passed, don't send anything (neither main nor pre-reminders)
        if (mainTime <= now) {
          continue;
        }
        
        // Check and send pre-reminders
        if (Array.isArray(toProcess.preReminder)) {
          // Find the closest pre-reminder that should be sent
          const closestPreReminder = findClosestPreReminder(toProcess, scheduledTimes);
          
          if (closestPreReminder) {
            sendPromises.push(
              processReminder(
                toProcess,
                phoneNumber,
                userName,
                closestPreReminder.type,
                closestPreReminder.scheduledFor
              )
            );
          } else {
            for (const preReminder of toProcess.preReminder) {
              const scheduledFor = scheduledTimes.preReminders[preReminder];
              if (scheduledFor && shouldSendReminder(toProcess, scheduledFor, preReminder)) {
                sendPromises.push(
                  processReminder(toProcess, phoneNumber, userName, preReminder, scheduledFor)
                );
              }
            }
          }
        }
        
        // Do not send reminder at the minute of the meeting – advance reminders only
      }
    }
    
    // Process all sends in parallel
    if (sendPromises.length > 0) {
      await Promise.allSettled(sendPromises);
    }
  } catch (error) {
    logError('Error in scheduler loop:', error);
  }
}

/**
 * Initializes reminder statuses on server startup
 * This ensures all reminders have proper status fields and scheduled times
 */
export async function initializeReminderStatuses() {
  try {
    logInfo('Initializing reminder statuses...');
    
    const allReminders = await getAllReminders();
    
    let updatedCount = 0;
    
    for (const [phoneNumber, userReminders] of Object.entries(allReminders)) {
      if (!Array.isArray(userReminders)) {
        continue;
      }
      
      for (const reminder of userReminders) {
        let toProcess = reminder;
        let validation = validateReminder(reminder);
        if (!validation.valid) {
          const onlyDurationError = validation.errors.length === 1 &&
            validation.errors[0] === 'Duration must be a number >= 15 and divisible by 15';
          if (onlyDurationError) {
            toProcess = { ...reminder, duration: normalizeDuration(reminder.duration) };
            await updateReminderStatus(phoneNumber, reminder.id, () => toProcess);
            validation = validateReminder(toProcess);
            updatedCount++;
          }
        }
        if (!validation.valid) {
          logWarn(`Skipping invalid reminder ${reminder.id}: ${validation.errors.join(', ')}`);
          continue;
        }
        
        const needsInit = !toProcess.mainReminderStatus?.scheduledFor ||
                         !toProcess.preReminderStatus;
        if (needsInit) {
          const initialized = initializeReminderStatusCalc(toProcess);
          await updateReminderStatus(phoneNumber, toProcess.id, () => initialized);
          updatedCount++;
        }
      }
    }
    
    logInfo(`Initialized statuses for ${updatedCount} reminders`);
  } catch (error) {
    logError('Error initializing reminder statuses:', error);
  }
}

/**
 * Starts the reminder scheduler
 */
export function startScheduler() {
  if (isRunning) {
    logWarn('Scheduler is already running');
    return;
  }
  
  logInfo('Starting reminder scheduler...');
  isRunning = true;
  
  // Run initial check
  schedulerLoop();
  
  // Set up interval for main scheduler loop (every 30 seconds)
  schedulerInterval = setInterval(() => {
    schedulerLoop();
  }, CHECK_INTERVAL);
  
  // Set up interval for retry processing (every minute)
  retryInterval = setInterval(() => {
    processRetries();
  }, RETRY_CHECK_INTERVAL);
  
  // Run cleanup on startup and then every 5 minutes
  cleanupExpiredReminders();
  cleanupInterval = setInterval(() => {
    cleanupExpiredReminders();
  }, 5 * 60 * 1000); // 5 minutes
  
  logInfo(`Scheduler started (check interval: ${CHECK_INTERVAL}ms, retry interval: ${RETRY_CHECK_INTERVAL}ms, cleanup interval: 5 minutes)`);
}

/**
 * Stops the reminder scheduler
 */
export function stopScheduler() {
  if (!isRunning) {
    return;
  }
  
  logInfo('Stopping reminder scheduler...');
  isRunning = false;
  
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
  
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  logInfo('Scheduler stopped');
}

/**
 * Checks if scheduler is running
 * @returns {boolean} True if running
 */
export function isSchedulerRunning() {
  return isRunning;
}

