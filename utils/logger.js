// Logger utility for consistent logging across the application

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
 * Logs an error message
 * @param {string} message - Error message to log
 * @param {Error} [error] - Optional error object
 */
export function logError(message, error = null) {
  const errorMessage = error ? `${message}: ${error.message}` : message;
  console.error(formatLogMessage(LogLevel.ERROR, errorMessage));
  if (error && error.stack) {
    console.error(error.stack);
  }
}

/**
 * Logs a warning message
 * @param {string} message - Warning message to log
 */
export function logWarn(message) {
  console.warn(formatLogMessage(LogLevel.WARN, message));
}

/**
 * Logs a debug message
 * @param {string} message - Debug message to log
 */
export function logDebug(message) {
  console.debug(formatLogMessage(LogLevel.DEBUG, message));
}

