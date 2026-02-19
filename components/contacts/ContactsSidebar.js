// Contacts Sidebar Component

import { getAllContacts } from '../../services/contactService.js';
import { createContactItem } from './ContactItem.js';
import { loadTodayAppointments, renderAppointmentsList, refreshAppointmentsView } from './AppointmentsSidebar.js';

let filteredContacts = [];
let searchFilter = '';

/**
 * Filters contacts based on search keyword
 * @param {string} keyword - Search keyword
 * @returns {Array} Filtered contacts array
 */
function filterContacts(keyword) {
  if (!keyword || keyword.trim() === '') {
    return getAllContacts();
  }

  const searchTerm = keyword.toLowerCase().trim();
  const allContacts = getAllContacts();

  return allContacts.filter(contact => {
    const nameMatch = contact.name?.toLowerCase().includes(searchTerm);
    const previewMatch = contact.preview?.toLowerCase().includes(searchTerm);
    return nameMatch || previewMatch;
  });
}

/**
 * Renders the contacts list in the sidebar
 * @param {string} searchKeyword - Optional search keyword to filter contacts. If not provided, uses current search filter.
 */
export function renderContacts(searchKeyword = null) {
  const contactsList = document.getElementById("contactsList");
  if (!contactsList) {
    console.error("Contacts list container not found");
    return;
  }

  // Use current search filter if no keyword provided
  const keyword = searchKeyword !== null ? searchKeyword : searchFilter;
  
  // Update search filter if new keyword provided
  if (searchKeyword !== null) {
    searchFilter = searchKeyword;
  }

  // Clear existing contacts
  contactsList.innerHTML = '';

  // Filter contacts based on search keyword
  filteredContacts = filterContacts(keyword);

  if (filteredContacts.length === 0) {
    // Show empty state message
    const emptyState = document.createElement("div");
    emptyState.className = "contacts-empty-state";
    emptyState.textContent = keyword 
      ? "לא נמצאו אנשי קשר התואמים לחיפוש" 
      : "אין אנשי קשר זמינים";
    contactsList.appendChild(emptyState);
    return;
  }

  filteredContacts.forEach((contact, index) => {
    // Use original index from all contacts for proper contact identification
    const originalIndex = getAllContacts().indexOf(contact);
    const contactItem = createContactItem(contact, originalIndex);
    contactsList.appendChild(contactItem);
  });
}

/**
 * Initializes the search functionality
 */
export function initializeContactsSearch() {
  const searchInput = document.getElementById("contactsSearchInput");
  if (!searchInput) {
    console.error("Contacts search input not found");
    return;
  }

  // Add input event listener for real-time filtering
  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value;
    renderContacts(keyword);
  });

  // Clear search on Escape key
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      searchInput.value = '';
      renderContacts('');
      searchInput.blur();
    }
  });
}

/**
 * Initialize main sidebar tabs (אנשי קשר | תורים) and appointments sub-tabs.
 * On mobile, default tab is "תורים".
 */
export function initContactsSidebarTabs() {
  const mainTabs = document.querySelectorAll('.contacts-sidebar-main-tabs .contacts-sidebar-tab');
  const contactsPanel = document.getElementById('contactsPanel');
  const appointmentsPanel = document.getElementById('appointmentsPanel');
  const subTabs = document.querySelectorAll('.appointments-sub-tabs .appointments-sub-tab');

  const isMobile = () => window.innerWidth <= 768;

  const switchToTab = (tabName) => {
    mainTabs.forEach((t) => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    if (contactsPanel) {
      contactsPanel.classList.toggle('hidden', tabName !== 'contacts');
    }
    if (appointmentsPanel) {
      appointmentsPanel.classList.toggle('hidden', tabName !== 'appointments');
    }
    if (tabName === 'appointments') {
      refreshAppointmentsView();
    }
  };

  mainTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });

  subTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      subTabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive);
      });
      loadTodayAppointments().then((list) => {
        renderAppointmentsList(list, tab.dataset.subtab);
      });
    });
  });

  if (isMobile()) {
    switchToTab('appointments');
  }
}
