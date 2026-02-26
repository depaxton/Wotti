// Message Bubble Component
// Displays individual message with copy/delete functionality

import { formatMessageTime, getStatusIcon, escapeHtml, highlightSearchQuery } from '../../services/chatService.js';

function getApiUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;
}

/**
 * Creates placeholder HTML for lazy-loaded media
 * @param {string} messageId - Message ID for fetching media
 * @param {string} type - WhatsApp message type (image, video, audio, document, etc.)
 */
function createMediaPlaceholder(messageId, type) {
  const typeClass = type || 'image';
  return `<div class="media-placeholder media-placeholder-${typeClass}" data-message-id="${escapeHtml(messageId)}" data-lazy-media>
    <div class="media-placeholder-spinner"></div>
    <span class="media-placeholder-text">טוען...</span>
  </div>`;
}

/**
 * Fetches media for a message and replaces the placeholder
 * @param {HTMLElement} placeholder - The placeholder element
 */
async function loadMediaForPlaceholder(placeholder) {
  const messageId = placeholder.dataset.messageId;
  if (!messageId || placeholder.dataset.loading === 'true') return;
  placeholder.dataset.loading = 'true';

  try {
    const response = await fetch(`${getApiUrl()}/api/chat/${messageId}/media`);
    if (!response.ok) throw new Error('Failed to load media');
    const media = await response.json();

    const mediaContainer = placeholder.parentElement;
    if (!mediaContainer) return;

    let mediaHtml = '';
    if (media.mimetype.startsWith('image/')) {
      mediaHtml = `<img src="data:${media.mimetype};base64,${media.data}" alt="Image" class="message-media" loading="lazy" />`;
    } else if (media.mimetype.startsWith('video/')) {
      mediaHtml = `<video controls class="message-media"><source src="data:${media.mimetype};base64,${media.data}" /></video>`;
    } else if (media.mimetype.startsWith('audio/')) {
      mediaHtml = `<audio controls class="message-audio"><source src="data:${media.mimetype};base64,${media.data}" /></audio>`;
    } else {
      mediaHtml = `<div class="message-file">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>${escapeHtml(media.filename || 'קובץ')}</span>
      </div>`;
    }
    placeholder.outerHTML = mediaHtml;
  } catch (error) {
    console.error('Error loading media for message', messageId, error);
    placeholder.innerHTML = '<span class="media-placeholder-error">שגיאה בטעינת המדיה</span>';
    placeholder.classList.add('media-placeholder-error');
  }
}

/**
 * Sets up IntersectionObserver for lazy-loading media placeholders
 * @param {HTMLElement} messageElement - The message element that may contain a placeholder
 */
function setupLazyMediaObserver(messageElement) {
  const placeholder = messageElement.querySelector('[data-lazy-media]');
  if (!placeholder) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadMediaForPlaceholder(entry.target);
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '100px', threshold: 0.01 }
  );
  observer.observe(placeholder);
}

/**
 * Creates a message bubble element
 * @param {Object} message - Message object
 * @param {string} searchQuery - Optional search query for highlighting
 * @returns {HTMLElement} Message bubble element
 */
export function createMessageBubble(message, searchQuery = '') {
  const isFromMe = message.fromMe;
  const time = formatMessageTime(message.timestamp);
  const statusIcon = getStatusIcon(message.ack, isFromMe);
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isFromMe ? 'message-out' : 'message-in'}`;
  messageDiv.dataset.messageId = message.id;
  
  let content = '';
  
  if (message.hasMedia && message.media) {
    if (message.media.mimetype.startsWith('image/')) {
      content = `<img src="data:${message.media.mimetype};base64,${message.media.data}" alt="Image" class="message-media" loading="lazy" />`;
    } else if (message.media.mimetype.startsWith('video/')) {
      content = `<video controls class="message-media"><source src="data:${message.media.mimetype};base64,${message.media.data}" /></video>`;
    } else if (message.media.mimetype.startsWith('audio/')) {
      content = `<audio controls class="message-audio"><source src="data:${message.media.mimetype};base64,${message.media.data}" /></audio>`;
    } else {
      content = `<div class="message-file">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <span>${escapeHtml(message.media.filename || 'קובץ')}</span>
      </div>`;
    }
    
    if (message.body) {
      const bodyText = searchQuery ? highlightSearchQuery(message.body, searchQuery) : escapeHtml(message.body);
      content += `<div class="message-text">${bodyText}</div>`;
    }
  } else if (message.hasMedia) {
    content = createMediaPlaceholder(message.id, message.type);
    if (message.body) {
      const bodyText = searchQuery ? highlightSearchQuery(message.body, searchQuery) : escapeHtml(message.body);
      content += `<div class="message-text">${bodyText}</div>`;
    }
  } else {
    const bodyText = searchQuery ? highlightSearchQuery(message.body, searchQuery) : escapeHtml(message.body);
    content = `<div class="message-text">${bodyText}</div>`;
  }
  
  messageDiv.innerHTML = `
    <div class="message-bubble">
      ${content}
      <div class="message-time">
        ${time} ${statusIcon}
      </div>
      <div class="message-actions">
        <button class="message-action-btn" data-action="copy" title="העתק">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>${isFromMe ? `
        <button class="message-action-btn" data-action="delete" title="מחק">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"></path>
          </svg>
        </button>` : ''}
      </div>
    </div>
  `;
  
  // Add event listeners for actions
  setupMessageActions(messageDiv, message);

  // Setup lazy load for media placeholder
  setupLazyMediaObserver(messageDiv);
  
  return messageDiv;
}

/**
 * Sets up event listeners for message actions (copy, delete)
 * @param {HTMLElement} messageElement - Message element
 * @param {Object} message - Message object
 */
function setupMessageActions(messageElement, message) {
  const copyBtn = messageElement.querySelector('[data-action="copy"]');
  const deleteBtn = messageElement.querySelector('[data-action="delete"]');
  
  // Copy functionality
  if (copyBtn) {
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const textToCopy = message.body || '';
        if (textToCopy) {
          await navigator.clipboard.writeText(textToCopy);
          
          // Show feedback
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          copyBtn.style.color = 'var(--color-green)';
          
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.style.color = '';
          }, 2000);
        }
      } catch (error) {
        console.error('Error copying message:', error);
      }
    });
  }
  
  // Delete functionality
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      if (!confirm('האם אתה בטוח שברצונך למחוק את ההודעה?')) {
        return;
      }
      
      try {
        const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;
        const response = await fetch(`${API_URL}/api/chat/${message.id}?forEveryone=false`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          // Remove message from UI
          messageElement.style.opacity = '0';
          messageElement.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            messageElement.remove();
          }, 300);
        } else {
          const error = await response.json();
          alert('שגיאה במחיקת ההודעה: ' + (error.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        alert('שגיאה במחיקת ההודעה');
      }
    });
  }
  
  // Show actions on hover
  messageElement.addEventListener('mouseenter', () => {
    const actions = messageElement.querySelector('.message-actions');
    if (actions) {
      actions.style.opacity = '1';
    }
  });
  
  messageElement.addEventListener('mouseleave', () => {
    const actions = messageElement.querySelector('.message-actions');
    if (actions) {
      actions.style.opacity = '0';
    }
  });
}

