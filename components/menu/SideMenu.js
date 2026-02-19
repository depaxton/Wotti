// Side Menu Component

import { createReminderSettingsPanel } from '../reminder/ReminderSettings.js';
import { createMeetingCalendarPanel } from '../meeting/MeetingCalendar.js';
import { createUserProfilePanel } from '../user/UserProfile.js';
import { createAISettingsPanel } from '../ai/AISettings.js';
import { createMarketingDistributionPanel } from '../marketing/MarketingDistributionPanel.js';
import { createBusinessHoursPanel } from '../businessHours/BusinessHours.js';
import { createServiceCategoriesPanel } from '../serviceCategories/ServiceCategories.js';
import { createLogsPanel } from '../logs/LogsPanel.js';

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

  // User Profile Menu Item
  const userProfileMenuItem = document.getElementById("userProfileMenuItem");
  if (userProfileMenuItem) {
    userProfileMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createUserProfilePanel();
    });
  }

  // Reminder Settings Menu Item
  const reminderSettingsMenuItem = document.getElementById("reminderSettingsMenuItem");
  if (reminderSettingsMenuItem) {
    reminderSettingsMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createReminderSettingsPanel();
    });
  }

  // Meeting Calendar Menu Item
  const meetingCalendarMenuItem = document.getElementById("meetingCalendarMenuItem");
  if (meetingCalendarMenuItem) {
    meetingCalendarMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createMeetingCalendarPanel();
    });
  }

  // AI Settings Menu Item
  const aiSettingsMenuItem = document.getElementById("aiSettingsMenuItem");
  if (aiSettingsMenuItem) {
    aiSettingsMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createAISettingsPanel();
    });
  }

  // Marketing Distribution Menu Item (הפצה שיווקית)
  const marketingDistributionMenuItem = document.getElementById("marketingDistributionMenuItem");
  if (marketingDistributionMenuItem) {
    marketingDistributionMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createMarketingDistributionPanel();
    });
  }

  // Business Hours Menu Item (שעות פעילות עסק)
  const businessHoursMenuItem = document.getElementById("businessHoursMenuItem");
  if (businessHoursMenuItem) {
    businessHoursMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createBusinessHoursPanel();
    });
  }

  // Service Categories Menu Item (קטגוריות שירות)
  const serviceCategoriesMenuItem = document.getElementById("serviceCategoriesMenuItem");
  if (serviceCategoriesMenuItem) {
    serviceCategoriesMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createServiceCategoriesPanel();
    });
  }

  // Logs Menu Item (לוגים – תצוגת מחשב בלבד)
  const logsMenuItem = document.getElementById("logsMenuItem");
  if (logsMenuItem) {
    logsMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      await createLogsPanel();
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

  // Load and display version
  loadVersion();
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

