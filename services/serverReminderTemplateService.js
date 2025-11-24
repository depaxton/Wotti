// Reminder Template Service (Server-side)
// Handles loading reminder templates from settings file

import fs from 'fs/promises';
import path from 'path';
import { REMINDER_TEMPLATE } from '../config/reminderTemplates.js';

const DATA_DIR = 'data';
const SETTINGS_FILE = path.join(process.cwd(), DATA_DIR, 'settings.json');

/**
 * Loads the reminder template from settings file
 * @returns {Promise<string>} The reminder template
 */
export async function loadReminderTemplate() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    return settings.reminderTemplate || REMINDER_TEMPLATE;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return REMINDER_TEMPLATE;
    }
    throw error;
  }
}

/**
 * Formats a reminder template with the given values
 * @param {string} template - The template string
 * @param {Object} values - Object with name, day, time, date, etc.
 * @returns {string} Formatted template
 */
export function formatReminderTemplate(template, values) {
  let formatted = template;
  
  if (values.name) {
    formatted = formatted.replace(/\{name\}/g, values.name);
  }
  
  if (values.day) {
    formatted = formatted.replace(/\{day\}/g, values.day);
  }
  
  if (values.time) {
    formatted = formatted.replace(/\{time\}/g, values.time);
  }
  
  if (values.date) {
    formatted = formatted.replace(/\{date\}/g, values.date);
  }
  
  return formatted;
}

