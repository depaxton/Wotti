// Reminder validation utilities
// Validates reminder data structure and values

import { DAYS_OF_WEEK } from '../config/reminderTemplates.js';
import { formatDateString, parseDateString } from './dateUtils.js';

const VALID_PRE_REMINDERS = ['30m', '1h', '1d', '3d', '1w'];

/** Default: 1h, 1d, 3d, 1w (30m off by default) */
export const DEFAULT_PRE_REMINDERS = ['1h', '1d', '3d', '1w'];
const VALID_TYPES = ['one-time', 'recurring'];

/**
 * Normalize duration to an integer >= 1 (free number of minutes, no 15-min step).
 * @param {number|undefined} minutes
 * @returns {number}
 */
export function normalizeDuration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.max(1, Math.round(n));
}

/**
 * Validates a reminder object
 * @param {Object} reminder - Reminder object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateReminder(reminder) {
  const errors = [];
  
  if (!reminder || typeof reminder !== 'object') {
    return { valid: false, errors: ['Reminder must be an object'] };
  }
  
  // Validate day or date (at least one must be present)
  const rawDate = typeof reminder.date === 'string' ? reminder.date.trim() : '';
  const rawDay = typeof reminder.day === 'string' ? reminder.day.trim() : '';
  const hasDate = rawDate !== '';
  const hasDay = rawDay !== '';
  
  if (!hasDate && !hasDay) {
    errors.push('Either day or date is required. Day must be a non-empty string, or date must be a string in YYYY-MM-DD format');
  }
  
  if (hasDay) {
    const validDays = DAYS_OF_WEEK.map(d => d.label);
    if (!validDays.includes(rawDay)) {
      errors.push(`Invalid day: ${rawDay}. Must be one of: ${validDays.join(', ')}`);
    }
  }
  
  if (hasDate) {
    const dateObj = parseDateString(rawDate);
    if (!dateObj) {
      errors.push(`Invalid date format: ${rawDate}. Must start with YYYY-MM-DD`);
    }
  }
  
  // Validate time
  if (!reminder.time || typeof reminder.time !== 'string') {
    errors.push('Time is required and must be a string');
  } else {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(reminder.time)) {
      errors.push(`Invalid time format: ${reminder.time}. Must be HH:MM`);
    }
  }
  
  // Validate duration (free number of minutes, no step)
  if (reminder.duration !== undefined) {
    const d = Number(reminder.duration);
    if (!Number.isFinite(d) || d < 1 || Math.round(d) !== d) {
      errors.push('Duration must be an integer >= 1 (minutes)');
    }
  }
  
  // Validate type
  if (reminder.type && !VALID_TYPES.includes(reminder.type)) {
    errors.push(`Invalid type: ${reminder.type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  
  // Validate preReminder
  if (reminder.preReminder !== undefined) {
    if (!Array.isArray(reminder.preReminder)) {
      errors.push('preReminder must be an array');
    } else {
      const invalid = reminder.preReminder.filter(p => !VALID_PRE_REMINDERS.includes(p));
      if (invalid.length > 0) {
        errors.push(`Invalid preReminder values: ${invalid.join(', ')}. Must be one of: ${VALID_PRE_REMINDERS.join(', ')}`);
      }
      
      // Check for duplicates
      const unique = [...new Set(reminder.preReminder)];
      if (unique.length !== reminder.preReminder.length) {
        errors.push('preReminder array contains duplicate values');
      }
    }
  }
  
  // Validate ID (should exist but not required for new reminders)
  if (reminder.id !== undefined && (typeof reminder.id !== 'string' && typeof reminder.id !== 'number')) {
    errors.push('ID must be a string or number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes a reminder object (sets defaults, ensures correct types)
 * @param {Object} reminder - Reminder object to normalize
 * @returns {Object} Normalized reminder
 */
export function normalizeReminder(reminder) {
  if (!reminder || typeof reminder !== 'object') {
    return null;
  }

  const rawDate = typeof reminder.date === 'string' ? reminder.date.trim() : '';
  const parsedDate = rawDate ? parseDateString(rawDate) : null;
  const normalizedDate = parsedDate ? formatDateString(parsedDate) : (rawDate || null);
  
  return {
    id: reminder.id || `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: reminder.createdAt || new Date().toISOString(),
    day: reminder.day || '',
    date: normalizedDate, // Support for specific date, canonicalized to YYYY-MM-DD when possible
    dateMode: reminder.dateMode || (normalizedDate ? 'specific-date' : 'day-of-week'), // Track which mode was used
    time: reminder.time || '',
    duration: normalizeDuration(reminder.duration ?? 45),
    type: reminder.type || 'one-time',
    title: reminder.title ?? null,
    categoryId: reminder.categoryId ?? null,
    treatmentId: reminder.treatmentId ?? null,
    bufferMinutes: reminder.bufferMinutes ?? null,
    preReminder: Array.isArray(reminder.preReminder) && reminder.preReminder.length > 0 ? reminder.preReminder : DEFAULT_PRE_REMINDERS,
    // Status fields are initialized separately
    preReminderStatus: reminder.preReminderStatus || {},
    mainReminderStatus: reminder.mainReminderStatus || {},
    recurringStatus: reminder.recurringStatus || {},
    // Google Calendar sync - preserved when present
    googleCalendarEventId: reminder.googleCalendarEventId ?? null,
    // Sidebar appointment edit - notes and "moved to past"
    notes: reminder.notes ?? '',
    completedAt: reminder.completedAt ?? null,
    // Manual appointment (no phone): display name for __manual__ user
    clientName: reminder.clientName ?? ''
  };
}

