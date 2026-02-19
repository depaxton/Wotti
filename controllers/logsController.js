// Logs API – serve stored log entries and clear logs

import { getLogEntries, clearLogEntries } from '../services/logStoreService.js';

/**
 * GET /api/logs
 * Query: level (optional) – ERROR | WARN; limit (optional) – max entries to return (default 500)
 */
export function getLogs(req, res) {
  const level = req.query.level || undefined;
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const { entries, total } = getLogEntries({ level, limit });
  res.json({ entries, total });
}

/**
 * DELETE /api/logs – clear all stored log entries
 */
export function clearLogs(req, res) {
  clearLogEntries();
  res.json({ success: true, message: 'Logs cleared' });
}
