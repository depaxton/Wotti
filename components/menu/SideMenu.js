// Side Menu Component

import { createReminderSettingsPanel } from '../reminder/ReminderSettings.js';
import { createMeetingCalendarPanel } from '../meeting/MeetingCalendar.js';
import { createUserProfilePanel } from '../user/UserProfile.js';

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
    userProfileMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      createUserProfilePanel();
    });
  }

  // Reminder Settings Menu Item
  const reminderSettingsMenuItem = document.getElementById("reminderSettingsMenuItem");
  if (reminderSettingsMenuItem) {
    reminderSettingsMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      createReminderSettingsPanel();
    });
  }

  // Meeting Calendar Menu Item
  const meetingCalendarMenuItem = document.getElementById("meetingCalendarMenuItem");
  if (meetingCalendarMenuItem) {
    meetingCalendarMenuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      createMeetingCalendarPanel();
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
}

