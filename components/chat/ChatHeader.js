// Chat Header Component
// Displays chat header with contact info

import { getAvatarColor, getContactIcon } from '../../utils/avatarUtils.js';

/**
 * Creates chat header component
 * @param {Object} contact - Contact object
 * @returns {HTMLElement} Chat header element
 */
export function createChatHeader(contact) {
  const header = document.createElement('div');
  header.className = 'chat-header';
  
  const avatarStyle = getAvatarColor(0); // Use first color for consistency
  const contactIcon = getContactIcon();
  
  header.innerHTML = `
    <div class="chat-header-info">
      <div class="chat-avatar" style="background: ${avatarStyle}">
        ${contactIcon}
      </div>
      <div class="chat-header-text">
        <div class="chat-name">${contact.name || contact.phone || 'Unknown'}</div>
      </div>
    </div>
  `;
  
  return header;
}

/**
 * Cleans up chat header
 */
export function cleanupChatHeader() {
  // No cleanup needed anymore
}

