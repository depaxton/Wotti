// Contact Item Component

import { getAvatarColor, getContactIcon } from '../../utils/avatarUtils.js';
import { removeActiveClass, addActiveClass } from '../../utils/domUtils.js';

/**
 * Creates and returns a contact item element
 * @param {Object} contact - Contact object with name, preview, time, unread, avatar
 * @param {number} index - Contact index
 * @returns {HTMLElement} Contact item element
 */
export function createContactItem(contact, index) {
  const contactItem = document.createElement("div");
  contactItem.className = "contact-item";
  contactItem.dataset.index = index;

  const avatarStyle = getAvatarColor(index);
  const contactIcon = getContactIcon();

  contactItem.innerHTML = `
    <div class="contact-avatar" style="background: ${avatarStyle}">
      ${contactIcon}
    </div>
    <div class="contact-info">
      <div class="contact-name">${contact.name}</div>
      <div class="contact-preview">${contact.preview}</div>
    </div>
    <div class="contact-meta">
      <div class="contact-time-wrapper">
        ${contact.date ? `<div class="contact-date">${contact.date}</div>` : ''}
        <div class="contact-time">${contact.time}</div>
      </div>
      ${contact.unread > 0 ? `<div class="contact-badge">${contact.unread}</div>` : ""}
    </div>
  `;

  // Add click handler
  contactItem.addEventListener("click", () => {
    // Add bounce animation
    contactItem.classList.add("bounce");
    setTimeout(() => {
      contactItem.classList.remove("bounce");
    }, 500);
    
    removeActiveClass(".contact-item");
    addActiveClass(contactItem);

    // Dispatch selection event
    const event = new CustomEvent('contactSelected', { detail: { contact } });
    document.dispatchEvent(event);
  });

  return contactItem;
}

