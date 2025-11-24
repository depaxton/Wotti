// Reminder service
// Handles loading and saving reminders to/from a separate JSON file
// Uses key-value structure: { "phoneNumber": [reminders...] }

import fs from 'fs/promises';
import path from 'path';
import { logError, logInfo } from '../utils/logger.js';

const DATA_DIR = 'data';
const FILE_NAME = 'reminders.json';
const FILE_PATH = path.join(process.cwd(), DATA_DIR, FILE_NAME);

/**
 * Ensures the data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), DATA_DIR), { recursive: true });
  } catch (error) {
    logError(`Failed to create data directory: ${error.message}`);
    throw error;
  }
}

/**
 * Loads reminders from the JSON file
 * @returns {Promise<Object>} Object with phone numbers as keys and reminder arrays as values
 */
export async function loadReminders() {
  await ensureDataDir();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    const reminders = JSON.parse(data);
    return reminders || {};
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return empty object
      logInfo('Reminders JSON file does not exist yet. Will be created on first reminder addition.');
      return {};
    }
    logError(`Failed to load reminders from ${FILE_PATH}: ${error.message}`);
    return {};
  }
}

/**
 * Saves reminders to the JSON file
 * @param {Object} reminders - Object with phone numbers as keys and reminder arrays as values
 */
export async function saveReminders(reminders) {
  await ensureDataDir();
  try {
    // Write with pretty formatting (2 spaces indentation)
    await fs.writeFile(FILE_PATH, JSON.stringify(reminders, null, 2), 'utf8');
    logInfo(`Saved reminders for ${Object.keys(reminders).length} users`);
  } catch (error) {
    logError(`Failed to save reminders to ${FILE_PATH}: ${error.message}`);
    throw error;
  }
}

/**
 * Gets reminders for a specific user by phone number
 * @param {string} phoneNumber - The user's phone number
 * @returns {Promise<Array>} Array of reminders for the user
 */
export async function getRemindersForUser(phoneNumber) {
  const reminders = await loadReminders();
  return reminders[phoneNumber] || [];
}

/**
 * Updates reminders for a specific user
 * @param {string} phoneNumber - The user's phone number
 * @param {Array} userReminders - Array of reminders to save for this user
 * @returns {Promise<Array>} The saved reminders array
 */
export async function updateRemindersForUser(phoneNumber, userReminders) {
  const reminders = await loadReminders();
  
  if (!Array.isArray(userReminders)) {
    throw new Error('Reminders must be an array');
  }
  
  reminders[phoneNumber] = userReminders;
  await saveReminders(reminders);
  
  logInfo(`Updated reminders for user ${phoneNumber} (${userReminders.length} reminders)`);
  return userReminders;
}

/**
 * Gets all reminders from all users
 * @returns {Promise<Object>} Object with phone numbers as keys and reminder arrays as values
 */
export async function getAllReminders() {
  return await loadReminders();
}

/**
 * Updates a specific reminder's status for a user
 * @param {string} phoneNumber - The user's phone number
 * @param {string} reminderId - The reminder ID
 * @param {Function} updateFn - Function that receives the reminder and returns updated reminder
 * @returns {Promise<Object|null>} Updated reminder or null if not found
 */
export async function updateReminderStatus(phoneNumber, reminderId, updateFn) {
  const reminders = await loadReminders();
  
  if (!reminders[phoneNumber]) {
    logError(`User ${phoneNumber} not found in reminders`);
    return null;
  }
  
  const userReminders = reminders[phoneNumber];
  const reminderIndex = userReminders.findIndex(r => r.id === reminderId);
  
  if (reminderIndex === -1) {
    logError(`Reminder ${reminderId} not found for user ${phoneNumber}`);
    return null;
  }
  
  // Apply update function
  const updatedReminder = updateFn(userReminders[reminderIndex]);
  
  // Update in array
  userReminders[reminderIndex] = updatedReminder;
  
  // Save back to file
  await saveReminders(reminders);
  
  logInfo(`Updated reminder status for ${phoneNumber} (reminder ID: ${reminderId})`);
  return updatedReminder;
}

/**
 * Finds a reminder by ID across all users
 * @param {string} reminderId - The reminder ID
 * @returns {Promise<{phoneNumber: string, reminder: Object}|null>} User phone and reminder, or null if not found
 */
export async function findReminderById(reminderId) {
  const reminders = await loadReminders();
  
  for (const [phoneNumber, userReminders] of Object.entries(reminders)) {
    if (!Array.isArray(userReminders)) {
      continue;
    }
    
    const reminder = userReminders.find(r => r.id === reminderId);
    if (reminder) {
      return { phoneNumber, reminder };
    }
  }
  
  return null;
}

