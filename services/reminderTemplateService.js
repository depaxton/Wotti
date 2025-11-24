// Reminder Template Service
// Handles loading the reminder template from the server

const API_URL = window.location.hostname === "localhost" 
  ? "http://localhost:5000" 
  : `${window.location.protocol}//${window.location.hostname}:5000`;

let cachedTemplate = null;

/**
 * Loads the reminder template from the server
 * @returns {Promise<string>} The reminder template
 */
export async function loadReminderTemplate() {
  // Return cached template if available
  if (cachedTemplate) {
    return cachedTemplate;
  }

  try {
    const response = await fetch(`${API_URL}/api/settings/reminder-template`);
    if (response.ok) {
      const data = await response.json();
      if (data.template) {
        cachedTemplate = data.template;
        return cachedTemplate;
      }
    }
  } catch (error) {
    console.error("Failed to load reminder template:", error);
  }

  // Fallback to default template if load fails
  const { REMINDER_TEMPLATE } = await import('../config/reminderTemplates.js');
  return REMINDER_TEMPLATE;
}

/**
 * Clears the cached template (use after updating template)
 */
export function clearTemplateCache() {
  cachedTemplate = null;
}

/**
 * Formats a reminder template with the given values
 * @param {string} template - The template string
 * @param {Object} values - Object with day, time, date, etc.
 * @returns {string} Formatted template
 */
export function formatReminderTemplate(template, values) {
  let formatted = template;
  
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

