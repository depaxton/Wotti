// Side Menu Component

import { createReminderSettingsPanel } from '../reminder/ReminderSettings.js';
import { createMeetingCalendarPanel } from '../meeting/MeetingCalendar.js';
import { createUserProfilePanel } from '../user/UserProfile.js';
import { createAISettingsPanel } from '../ai/AISettings.js';
import { createMarketingDistributionPanel } from '../marketing/MarketingDistributionPanel.js';
import { createBusinessHoursPanel } from '../businessHours/BusinessHours.js';
import { createServiceCategoriesPanel } from '../serviceCategories/ServiceCategories.js';
import { createReadyMessagesPanel } from '../readyMessages/ReadyMessagesPanel.js';
import { createLogsPanel } from '../logs/LogsPanel.js';
import { isMobile, showContactsSidebar } from '../../utils/mobileNavigation.js';

// מיפוי תת-URL (hash) → פונקציה שפותחת את הפאנל. ריענון על ה-URL יפתח את אותו מסך.
const ROUTE_MAP = {
  profile: createUserProfilePanel,
  reminders: createReminderSettingsPanel,
  meetings: createMeetingCalendarPanel,
  'ai-settings': createAISettingsPanel,
  marketing: createMarketingDistributionPanel,
  'ready-messages': createReadyMessagesPanel,
  'business-hours': createBusinessHoursPanel,
  'service-categories': createServiceCategoriesPanel,
  logs: createLogsPanel,
};

/** מחזיר את מזהי ה-route מה-hash (למשל "ai-settings" מ-#/ai-settings) */
function getHashRoute() {
  const hash = (window.location.hash || '').replace(/^#\/?/, '').trim();
  return hash || 'home';
}

/** פותח את הפאנל המתאים ל-route הנוכחי (טעינה ראשונית + hashchange) */
async function openPanelFromHash() {
  const route = getHashRoute();
  if (route === 'home') {
    goToHome();
    return;
  }
  const openPanel = ROUTE_MAP[route];
  if (openPanel) {
    await openPanel();
  }
}

/** מעדכן את ה-URL ומונע טעינה מחדש – הקליק בתפריט רק מעדכן hash, ו-hashchange פותח את הפאנל */
function navigateToRoute(routeId) {
  if (!routeId || routeId === 'home') {
    window.location.hash = '#/';
    return;
  }
  window.location.hash = '#/' + routeId;
}

/**
 * Initializes the side menu toggle functionality
 */
export function initSideMenu() {
  const sideMenu = document.getElementById("sideMenu");
  const menuToggle = document.getElementById("menuToggle");
  const appContainer = document.querySelector(".app-container");

  if (!sideMenu || !menuToggle || !appContainer) {
    console.error("Side menu elements not found");
    return;
  }

  // Track if menu was manually expanded via click
  let isManuallyExpanded = false;

  // Expand menu on hover
  sideMenu.addEventListener("mouseenter", () => {
    if (!isManuallyExpanded) {
      sideMenu.classList.add("expanded");
      appContainer.classList.add("menu-expanded");
    }
  });

  // Collapse menu when mouse leaves (only if not manually expanded)
  sideMenu.addEventListener("mouseleave", () => {
    if (!isManuallyExpanded) {
      sideMenu.classList.remove("expanded");
      appContainer.classList.remove("menu-expanded");
    }
  });

  // Toggle menu when clicking the hamburger icon
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    isManuallyExpanded = !isManuallyExpanded;
    sideMenu.classList.toggle("expanded");
    appContainer.classList.toggle("menu-expanded");
  });

  // Expand menu when clicking anywhere on the side menu (if not already expanded)
  sideMenu.addEventListener("click", (e) => {
    // Only expand if menu is not already expanded
    if (!sideMenu.classList.contains("expanded")) {
      isManuallyExpanded = true;
      sideMenu.classList.add("expanded");
      appContainer.classList.add("menu-expanded");
    }
  });

  // Home Menu Item (מובייל בלבד – מעבר למסך הראשי: אנשי קשר ותורים)
  const homeMenuItem = document.getElementById("homeMenuItem");
  if (homeMenuItem) {
    homeMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isMobile()) return;
      navigateToRoute("home");
      // כשהמשתמש כבר במסך הבית (צ'אט עם משתמש) – hash לא משתנה ולכן hashchange לא יופעל.
      // קוראים ל-goToHome ישירות כדי להחזיר לאנשי קשר גם במצב זה.
      goToHome();
    });
  }

  // User Profile Menu Item
  const userProfileMenuItem = document.getElementById("userProfileMenuItem");
  if (userProfileMenuItem) {
    userProfileMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("profile");
    });
  }

  // Reminder Settings Menu Item
  const reminderSettingsMenuItem = document.getElementById("reminderSettingsMenuItem");
  if (reminderSettingsMenuItem) {
    reminderSettingsMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("reminders");
    });
  }

  // Meeting Calendar Menu Item
  const meetingCalendarMenuItem = document.getElementById("meetingCalendarMenuItem");
  if (meetingCalendarMenuItem) {
    meetingCalendarMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("meetings");
    });
  }

  // AI Settings Menu Item
  const aiSettingsMenuItem = document.getElementById("aiSettingsMenuItem");
  if (aiSettingsMenuItem) {
    aiSettingsMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("ai-settings");
    });
  }

  // Marketing Distribution Menu Item (הפצה שיווקית)
  const marketingDistributionMenuItem = document.getElementById("marketingDistributionMenuItem");
  if (marketingDistributionMenuItem) {
    marketingDistributionMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("marketing");
    });
  }

  // Ready Messages Menu Item (הודעות מוכנות)
  const readyMessagesMenuItem = document.getElementById("readyMessagesMenuItem");
  if (readyMessagesMenuItem) {
    readyMessagesMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("ready-messages");
    });
  }

  // Business Hours Menu Item (שעות פעילות עסק)
  const businessHoursMenuItem = document.getElementById("businessHoursMenuItem");
  if (businessHoursMenuItem) {
    businessHoursMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("business-hours");
    });
  }

  // Service Categories Menu Item (קטגוריות שירות)
  const serviceCategoriesMenuItem = document.getElementById("serviceCategoriesMenuItem");
  if (serviceCategoriesMenuItem) {
    serviceCategoriesMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("service-categories");
    });
  }

  // Logs Menu Item (לוגים – תצוגת מחשב בלבד)
  const logsMenuItem = document.getElementById("logsMenuItem");
  if (logsMenuItem) {
    logsMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateToRoute("logs");
    });
  }

  // Close menu when clicking outside (optional)
  document.addEventListener("click", (e) => {
    if (!sideMenu.contains(e.target) && sideMenu.classList.contains("expanded")) {
      // Uncomment below if you want menu to close when clicking outside
      // sideMenu.classList.remove("expanded");
      // appContainer.classList.remove("menu-expanded");
    }
  });

  // טעינה ראשונית: אם יש hash (למשל אחרי ריענון) – לפתוח את המסך המתאים
  const initialRoute = getHashRoute();
  if (initialRoute !== 'home') {
    openPanelFromHash();
  }

  // כפתור אחורה/קדימה או קישור עם hash – לסנכרן את המסך
  window.addEventListener("hashchange", () => {
    openPanelFromHash();
  });

  // Load and display version
  loadVersion();
}

/**
 * מעבר למסך הבית (אנשי קשר + תורים) – סוגר את כל הפאנלים שנפתחו (מובייל)
 */
function goToHome() {
  const chatArea = document.querySelector(".chat-area");
  const placeholderHtml = `
    <div class="chat-placeholder" id="chatPlaceholder">
      <div class="placeholder-content">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <h2>בחר איש קשר כדי להכניס תזכורות</h2>
        <p>התזכורות שלך יופיעו כאן</p>
      </div>
    </div>
  `;

  const panelSelectors = [
    ".marketing-panel",
    ".user-profile-panel",
    ".reminder-settings-panel",
    ".meeting-calendar-panel",
    ".ai-settings-panel",
    ".logs-panel",
    ".business-hours-panel",
    ".service-categories-panel",
    ".ready-messages-panel",
    ".day-reminders-sidebar",
    ".sliding-panel-overlay",
    ".sliding-panel",
    ".day-details-modal",
    ".service-categories-modal-overlay",
    ".marketing-modal-overlay",
    ".appointment-edit-overlay",
  ];

  panelSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  });

  if (chatArea) {
    chatArea.innerHTML = placeholderHtml;
    document.dispatchEvent(new CustomEvent("chatPlaceholderRestored"));
  }

  showContactsSidebar();
}

/**
 * Loads and displays the current version
 */
async function loadVersion() {
  const versionElement = document.getElementById("versionNumber");
  if (!versionElement) {
    return;
  }

  try {
    const API_URL = window.location.hostname === "localhost" 
      ? "http://localhost:5000" 
      : `${window.location.protocol}//${window.location.hostname}:5000`;
    
    const response = await fetch(`${API_URL}/api/version`);
    if (response.ok) {
      const data = await response.json();
      versionElement.textContent = `v${data.version}`;
    } else {
      versionElement.textContent = "N/A";
    }
  } catch (error) {
    console.error("Error loading version:", error);
    versionElement.textContent = "N/A";
  }
}

