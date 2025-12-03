// Message Bubble Component
// Displays individual message with copy/delete functionality

import { formatMessageTime, getStatusIcon, escapeHtml, highlightSearchQuery } from '../../services/chatService.js';

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

