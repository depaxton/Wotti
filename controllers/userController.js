import { getAllUsers, updateUser } from '../services/userService.js';
import { getRemindersForUser, updateRemindersForUser, getAllReminders, updateReminderStatus } from '../services/reminderService.js';

/**
 * GET /api/reminders/all
 * Gets all reminders from all users
 */
export async function getAllRemindersController(req, res) {
  try {
    const allReminders = await getAllReminders();
    res.json(allReminders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load reminders' });
  }
}
import { getClient, isClientReady } from '../services/whatsappClient.js';
import { loadReminderTemplate, formatReminderTemplate } from '../services/serverReminderTemplateService.js';
import { initializeReminderStatus, markReminderAsSent } from '../services/reminderCalculator.js';
import { validateReminder, normalizeReminder } from '../utils/reminderValidation.js';
import { logError, logInfo } from '../utils/logger.js';

export async function getAllUsersController(req, res) {
  try {
    // Get users and reminders
    const [users, allReminders] = await Promise.all([
      getAllUsers(),
      getAllReminders()
    ]);

    // Merge reminders into users for the schedule view
    // This allows the frontend to see all meetings across all users
    const result = { ...users };
    
    Object.keys(allReminders).forEach(phone => {
        if (!result[phone]) {
            result[phone] = { phone, name: phone }; // Minimal user stub
        }
        result[phone].reminders = allReminders[phone];
    });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load users' });
  }
}

export async function getUserReminders(req, res) {
  try {
    const { phone } = req.params;
    const reminders = await getRemindersForUser(phone);
    // Return empty array if no reminders (user might not exist in reminders.json yet)
    res.json(reminders || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load reminders' });
  }
}

export async function saveUserReminders(req, res) {
  try {
    const { phone } = req.params;
    const { reminders } = req.body; // Expecting { reminders: [...] }
    
    if (!Array.isArray(reminders)) {
      return res.status(400).json({ error: 'Reminders must be an array' });
    }

    // Get existing reminders to check which are new/updated
    const existingReminders = await getRemindersForUser(phone);
    const existingById = new Map(existingReminders.map(r => [r.id, r]));

    // Process and initialize status for each reminder
    const processedReminders = reminders.map(reminder => {
      // Normalize reminder
      const normalized = normalizeReminder(reminder);
      
      // Validate reminder
      const validation = validateReminder(normalized);
      if (!validation.valid) {
        logError(`Invalid reminder ${normalized.id}: ${validation.errors.join(', ')}`);
        // Still return normalized reminder, but validation failed
        return normalized;
      }

      // Check if this is a new reminder or updated
      const existing = existingById.get(normalized.id);
      
      // If reminder exists, check if it was updated
      if (existing) {
        const wasUpdated = existing.day !== normalized.day ||
                          existing.time !== normalized.time ||
                          JSON.stringify(existing.preReminder) !== JSON.stringify(normalized.preReminder) ||
                          existing.type !== normalized.type;
        
        if (wasUpdated) {
          // Reset status for updated reminder
          return initializeReminderStatus(normalized);
        } else {
          // Keep existing status
          return normalized;
        }
      } else {
        // New reminder - initialize status
        return initializeReminderStatus(normalized);
      }
    });

    const updatedReminders = await updateRemindersForUser(phone, processedReminders);
    
    // Set explicit headers to prevent any browser interpretation issues
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json(updatedReminders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save reminders' });
  }
}

/**
 * POST /api/users/:phone/send-reminder
 * Sends a reminder message manually for a specific reminder
 */
export async function sendReminderManually(req, res) {
  try {
    const { phone } = req.params;
    const { reminderId } = req.body;

    if (!reminderId) {
      return res.status(400).json({ error: 'Reminder ID is required' });
    }

    // Get client and check if ready
    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: 'Client not initialized' });
    }

    const ready = await isClientReady();
    if (!ready) {
      return res.status(503).json({ error: 'Client not ready' });
    }

    // Get user's reminders
    const reminders = await getRemindersForUser(phone);
    const reminder = reminders.find(r => r.id === reminderId);

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    // Get user info for name
    const users = await getAllUsers();
    const user = users[phone];
    const userName = user?.name || phone;

    // Load and format template
    const template = await loadReminderTemplate();
    
    // Calculate date if needed
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

    const formattedMessage = formatReminderTemplate(template, {
      name: userName,
      day: dayDisplay,
      time: reminder.time,
      date: dateStr
    });

    // Format phone number for WhatsApp
    let formattedPhone = phone.replace(/\+/g, '');
    const chatId = `${formattedPhone}@c.us`;

    // Send the message
    await client.sendMessage(chatId, formattedMessage);
    
    // Mark all pre-reminders as sent to prevent scheduler from sending them
    // This ensures manual send only sends the main reminder, not pre-reminders
    // We don't mark the main reminder as sent so it can still be sent by scheduler in the future
    if (Array.isArray(reminder.preReminder) && reminder.preReminder.length > 0) {
      const updatedReminder = { ...reminder };
      if (!updatedReminder.preReminderStatus) {
        updatedReminder.preReminderStatus = {};
      }
      
      // Mark all pre-reminders as sent
      for (const preReminderType of reminder.preReminder) {
        updatedReminder.preReminderStatus[preReminderType] = {
          ...updatedReminder.preReminderStatus[preReminderType],
          sent: true,
          sentAt: new Date().toISOString(),
          failed: false
        };
      }
      
      await updateReminderStatus(phone, reminderId, () => updatedReminder);
    }
    
    logInfo(`Reminder sent manually to ${phone} (reminder ID: ${reminderId})`);
    res.json({ success: true, message: 'Reminder sent successfully' });
  } catch (error) {
    logError('Error sending reminder manually', error);
    res.status(500).json({ error: error.message || 'Failed to send reminder' });
  }
}

/**
 * PUT /api/users/:phone/name
 * Updates the name of a user
 */
export async function updateUserName(req, res) {
  try {
    const { phone } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
    }

    const decodedPhone = decodeURIComponent(phone);
    const updatedUser = await updateUser(decodedPhone, { name: name.trim() });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user name:', error);
    if (error.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Failed to update user name' });
  }
}

