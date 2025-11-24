// Contact data management service

// Contacts data - starts empty, will be populated from API
let contacts = [];

/**
 * Gets all contacts
 * @returns {Array} Array of contact objects
 */
export function getAllContacts() {
  return contacts;
}

/**
 * Sets/updates the contacts list
 * @param {Array} newContacts - Array of contact objects
 */
export function setContacts(newContacts) {
  if (Array.isArray(newContacts)) {
    contacts = newContacts;
  }
}

/**
 * Gets a contact by index
 * @param {number} index - Contact index
 * @returns {Object|null} Contact object or null if not found
 */
export function getContactByIndex(index) {
  if (index >= 0 && index < contacts.length) {
    return contacts[index];
  }
  return null;
}

/**
 * Gets total unread count across all contacts
 * @returns {number} Total unread messages count
 */
export function getTotalUnreadCount() {
  return contacts.reduce((total, contact) => total + contact.unread, 0);
}

