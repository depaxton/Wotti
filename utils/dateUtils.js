// Date utility functions for reminder scheduling
// Handles date calculations, day-of-week conversions, and timezone management

const TIMEZONE = 'Asia/Jerusalem'; // Israel timezone

/**
 * Maps Hebrew day names to JavaScript day indices (0 = Sunday, 6 = Saturday)
 */
const DAY_NAME_TO_INDEX = {
  'ראשון': 0,
  'שני': 1,
  'שלישי': 2,
  'רביעי': 3,
  'חמישי': 4,
  'שישי': 5,
  'שבת': 6
};

/**
 * Maps JavaScript day indices to Hebrew day names
 */
const INDEX_TO_DAY_NAME = {
  0: 'ראשון',
  1: 'שני',
  2: 'שלישי',
  3: 'רביעי',
  4: 'חמישי',
  5: 'שישי',
  6: 'שבת'
};

/**
 * Gets the day index for a Hebrew day name
 * @param {string} dayName - Hebrew day name (e.g., "חמישי")
 * @returns {number} Day index (0-6) or null if invalid
 */
export function getDayIndex(dayName) {
  return DAY_NAME_TO_INDEX[dayName] ?? null;
}

/**
 * Gets Hebrew day name for a day index
 * @param {number} dayIndex - Day index (0-6)
 * @returns {string} Hebrew day name
 */
export function getDayName(dayIndex) {
  return INDEX_TO_DAY_NAME[dayIndex] ?? null;
}

/**
 * Parses time string (HH:MM) into hours and minutes
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {[number, number]} [hours, minutes] or null if invalid
 */
export function parseTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return null;
  }
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  return [hours, minutes];
}

/**
 * Gets the next occurrence of a specific day of week from a given date
 * Returns today if it's the same day, otherwise returns next occurrence
 * @param {Date} fromDate - Starting date
 * @param {number} targetDayIndex - Target day index (0-6)
 * @returns {Date} Next occurrence of the target day (could be today if same day)
 */
export function getNextDayOfWeek(fromDate, targetDayIndex) {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  let daysUntilTarget = targetDayIndex - currentDay;
  
  // If target day is today (daysUntilTarget === 0), return today
  // If target day already passed this week (daysUntilTarget < 0), get next week's occurrence
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7;
  }
  // If daysUntilTarget === 0, we keep it as 0 (same day)
  
  result.setDate(result.getDate() + daysUntilTarget);
  return result;
}

/**
 * Gets Sunday (start of week) for a given date
 * @param {Date} date - Input date
 * @returns {Date} Sunday of the week containing the input date
 */
export function getWeekStart(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day); // Go back to Sunday
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Formats date as YYYY-MM-DD string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses date string (YYYY-MM-DD) to Date object
 * @param {string} dateStr - Date string
 * @returns {Date} Date object or null if invalid
 */
export function parseDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }
  
  const date = new Date(year, month, day);
  
  // Validate date
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  
  return date;
}

/**
 * Checks if two dates are in the same week
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same week
 */
export function isSameWeek(date1, date2) {
  const week1 = getWeekStart(date1);
  const week2 = getWeekStart(date2);
  return week1.getTime() === week2.getTime();
}

/**
 * Gets current date/time in Israel timezone
 * @returns {Date} Current date
 */
export function getCurrentDate() {
  return new Date();
}

/**
 * Adds time interval to a date
 * @param {Date} date - Base date
 * @param {string} interval - Interval string (e.g., "30m", "1h", "1d")
 * @returns {Date} New date with interval added, or null if invalid interval
 */
export function addInterval(date, interval) {
  const result = new Date(date);
  
  if (!interval || typeof interval !== 'string') {
    return null;
  }
  
  // Parse interval: "30m", "1h", "1d"
  const match = interval.match(/^(\d+)([mhd])$/);
  if (!match) {
    return null;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'm': // minutes
      result.setMinutes(result.getMinutes() - value); // Subtract because we want "before"
      break;
    case 'h': // hours
      result.setHours(result.getHours() - value);
      break;
    case 'd': // days
      result.setDate(result.getDate() - value);
      break;
    default:
      return null;
  }
  
  return result;
}

/**
 * Checks if a date is in the past (with margin)
 * @param {Date} date - Date to check
 * @param {number} marginSeconds - Margin in seconds (default: 30)
 * @returns {boolean} True if date is in the past
 */
export function isPast(date, marginSeconds = 30) {
  const now = getCurrentDate();
  const margin = marginSeconds * 1000;
  return date.getTime() < (now.getTime() - margin);
}

/**
 * Checks if a date is within the next N seconds
 * @param {Date} date - Date to check
 * @param {number} seconds - Seconds window (default: 30)
 * @returns {boolean} True if date is within the window
 */
export function isWithinNext(date, seconds = 30) {
  const now = getCurrentDate();
  const nowMs = now.getTime();
  const dateMs = date.getTime();
  const windowMs = seconds * 1000;
  
  return dateMs >= nowMs && dateMs <= (nowMs + windowMs);
}

/**
 * Formats a date for Hebrew display (e.g., "15/03/2024, יום שישי")
 * @param {Date|string} date - Date object or date string (YYYY-MM-DD)
 * @returns {string} Formatted date string in Hebrew
 */
export function formatDateHebrew(date) {
  let dateObj;
  
  if (typeof date === 'string') {
    dateObj = parseDateString(date);
    if (!dateObj) return date; // Return original if parsing fails
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }
  
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  const dayIndex = dateObj.getDay();
  const dayName = getDayName(dayIndex);
  
  return `${day}/${month}/${year}, יום ${dayName}`;
}

/**
 * Formats a date as month/day only (e.g., "15/03")
 * @param {Date|string} date - Date object or date string (YYYY-MM-DD)
 * @returns {string} Formatted date string (DD/MM)
 */
export function formatDateMonthDay(date) {
  let dateObj;
  
  if (typeof date === 'string') {
    dateObj = parseDateString(date);
    if (!dateObj) return '';
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return '';
  }
  
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  
  return `${day}/${month}`;
}

/**
 * Gets the next occurrence of a day of week from today
 * @param {string} dayName - Hebrew day name (e.g., "ראשון", "שני")
 * @returns {Date} Next occurrence of the day
 */
export function getNextDayOfWeekFromToday(dayName) {
  const dayIndex = getDayIndex(dayName);
  if (dayIndex === null) return null;
  
  const today = getCurrentDate();
  return getNextDayOfWeek(today, dayIndex);
}

