// Logger utility for consistent logging across the application

import { addLogEntry } from '../services/logStoreService.js';

/**
 * Log levels
 */
const LogLevel = {
  INFO: 'INFO',
  ERROR: 'ERROR',
  WARN: 'WARN',
  DEBUG: 'DEBUG',
};

/**
 * Formats log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @returns {string} Formatted log message
 */
function formatLogMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
}

/**
 * Logs an info message
 * @param {string} message - Message to log
 */
export function logInfo(message) {
  console.log(formatLogMessage(LogLevel.INFO, message));
}

/**
 * Logs an error message and stores it for the Logs UI
 * @param {string} message - Error message to log
 * @param {Error} [error] - Optional error object
 */
export function logError(message, error = null) {
  const errorMessage = error ? `${message}: ${error.message}` : message;
  console.error(formatLogMessage(LogLevel.ERROR, errorMessage));
  if (error && error.stack) {
    console.error(error.stack);
  }
  try {
    addLogEntry(LogLevel.ERROR, errorMessage, { stack: error?.stack });
  } catch (e) {
    console.error('Failed to add error to log store', e);
  }
}

/**
 * Logs a warning message and stores it for the Logs UI
 * @param {string} message - Warning message to log
 */
export function logWarn(message) {
  console.warn(formatLogMessage(LogLevel.WARN, message));
  try {
    addLogEntry(LogLevel.WARN, message);
  } catch (e) {
    console.error('Failed to add warning to log store', e);
  }
}

/**
 * Logs a debug message
 * @param {string} message - Debug message to log
 */
export function logDebug(message) {
  console.debug(formatLogMessage(LogLevel.DEBUG, message));
}

