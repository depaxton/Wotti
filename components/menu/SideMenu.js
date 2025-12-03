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


  // Restart Menu Item
  const restartMenuItem = document.getElementById("restartMenuItem");
  if (restartMenuItem) {
    restartMenuItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      
      // Confirm restart
      const confirmed = confirm("האם אתה בטוח שברצונך להפעיל מחדש את התוכנה?");
      if (!confirmed) {
        return;
      }

      // Add restarting state
      restartMenuItem.classList.add("restarting");
      restartMenuItem.disabled = true;

      try {
        // Get API URL
        const API_URL = window.location.hostname === "localhost" 
          ? "http://localhost:5000" 
          : `${window.location.protocol}//${window.location.hostname}:5000`;

        // Call restart API
        const response = await fetch(`${API_URL}/api/restart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          // Show message to user
          alert("התוכנה מופעלת מחדש. הדף יטען מחדש בעוד כמה שניות...");
          
          // Wait a bit and then reload the page
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          const error = await response.json();
          alert(`שגיאה בהפעלה מחדש: ${error.error || "שגיאה לא ידועה"}`);
          restartMenuItem.classList.remove("restarting");
          restartMenuItem.disabled = false;
        }
      } catch (error) {
        console.error("Error restarting application:", error);
        alert(`שגיאה בהפעלה מחדש: ${error.message}`);
        restartMenuItem.classList.remove("restarting");
        restartMenuItem.disabled = false;
      }
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

