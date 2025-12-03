// Chat service
// Business logic for chat operations

import { logInfo, logError } from '../utils/logger.js';

/**
 * Formats message timestamp for display
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted time string
 */
export function formatMessageTime(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Today - show time only
  if (diffMins < 1) {
    return "עכשיו";
  } else if (diffMins < 60) {
    return `${diffMins} דק'`;
  } else if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return "אתמול";
  } else if (diffDays < 7) {
    return date.toLocaleDateString('he-IL', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  }
}

/**
 * Gets status icon HTML based on message acknowledgment
 * @param {number} ack - Acknowledgment status (0=sent, 1=delivered, 2=read, 3=played)
 * @param {boolean} isFromMe - Whether message is from current user
 * @returns {string} Status icon HTML
 */
export function getStatusIcon(ack, isFromMe) {
  if (!isFromMe) return '';

  // 0 = sent, 1 = delivered, 2 = read, 3 = played
  if (ack === 2 || ack === 3) {
    return '<span class="status-icon status-read">✓✓</span>'; // Two blue checkmarks
  } else if (ack === 1) {
    return '<span class="status-icon status-delivered">✓✓</span>'; // Two gray checkmarks
  } else {
    return '<span class="status-icon status-sent">✓</span>'; // Single checkmark
  }
}

/**
 * Escapes HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlights search query in text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted query
 */
export function highlightSearchQuery(text, query) {
  if (!text || !query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Checks if two timestamps are on different days
 * @param {number} timestamp1 - First timestamp in seconds
 * @param {number} timestamp2 - Second timestamp in seconds
 * @returns {boolean} True if different days
 */
export function isDifferentDay(timestamp1, timestamp2) {
  if (!timestamp1 || !timestamp2) return false;
  
  const date1 = new Date(timestamp1 * 1000);
  const date2 = new Date(timestamp2 * 1000);
  
  return (
    date1.getDate() !== date2.getDate() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getFullYear() !== date2.getFullYear()
  );
}

/**
 * Formats date for date divider display (like WhatsApp)
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted date string
 */
export function formatDateDivider(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - messageDate) / (1000 * 60 * 60 * 24));
  
  // Today
  if (diffDays === 0) {
    return 'היום';
  }
  
  // Yesterday
  if (diffDays === 1) {
    return 'אתמול';
  }
  
  // This week (last 7 days)
  if (diffDays < 7) {
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = dayNames[date.getDay()];
    return `יום ${dayName}`;
  }
  
  // Older dates (more than a week) - show full date with numbers
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  // Always show full date for dates older than a week
  return `${day}/${month}/${year}`;
}

