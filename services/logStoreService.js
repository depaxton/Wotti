// Log store service – in-memory store for error/warn logs (for Logs UI).
// Bounded size so logs don't accumulate for months; clear API to reset.

const DEFAULT_MAX_ENTRIES = 2000;

/** @type {{ timestamp: string, level: string, message: string, stack?: string, source?: string }[]} */
let entries = [];
let maxEntries = DEFAULT_MAX_ENTRIES;

/**
 * Add a log entry. Keeps only the last maxEntries.
 * @param {string} level - 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
 * @param {string} message - Log message
 * @param {{ stack?: string, source?: string }} [meta] - Optional stack trace or source
 */
export function addLogEntry(level, message, meta = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
    ...(meta.stack && { stack: meta.stack }),
    ...(meta.source && { source: meta.source }),
  };
  entries.push(record);
  if (entries.length > maxEntries) {
    entries = entries.slice(-maxEntries);
  }
}

/**
 * Get stored log entries, optionally filtered by level.
 * @param {{ level?: string, limit?: number }} [opts] - Filter by level, limit count (default 500)
 * @returns {{ entries: typeof entries, total: number }}
 */
export function getLogEntries(opts = {}) {
  const { level, limit = 500 } = opts;
  let list = entries;
  if (level) {
    list = list.filter((e) => e.level === level);
  }
  const total = list.length;
  const slice = list.slice(-limit).reverse(); // תצוגה: מחדש לישן
  return { entries: slice, total };
}

/**
 * Clear all stored log entries.
 */
export function clearLogEntries() {
  entries = [];
}

/**
 * Set max number of entries to retain (for future use).
 * @param {number} n
 */
export function setMaxEntries(n) {
  maxEntries = Math.max(100, Math.min(10000, n));
  if (entries.length > maxEntries) {
    entries = entries.slice(-maxEntries);
  }
}
