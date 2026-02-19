// User Profile Component
// Displays logged-in user's profile information

import { toast } from '../toast/Toast.js';
import { formatIsraeliMobile } from '../../utils/phoneUtils.js';

const API_URL = window.location.hostname === "localhost" 
  ? "http://localhost:5000" 
  : `${window.location.protocol}//${window.location.hostname}:5000`;

/**
 * Creates the user profile panel
 */
export async function createUserProfilePanel() {
  // Get chat area
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) {
    console.error("Chat area not found");
    return;
  }

  // Clear chat area
  chatArea.innerHTML = "";

  // Panel
  const panel = document.createElement("div");
  panel.className = "user-profile-panel user-profile-panel-center";
  
  // Handle mobile navigation
  const { isMobile, showChatArea } = await import("../../utils/mobileNavigation.js");
  const isMobileDevice = isMobile();
  
  if (isMobileDevice) {
    panel.classList.add("active");
  }

  // Header
  const header = document.createElement("div");
  header.className = "user-profile-header";
  
  header.innerHTML = `
    ${isMobileDevice ? `
      <button type="button" class="panel-back-button" aria-label="חזור לאנשי קשר" title="חזור לאנשי קשר">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>חזרה</span>
      </button>
    ` : ''}
    <div class="panel-header-content">
      <h2>הגדרות פרופיל</h2>
    </div>
    <button type="button" class="close-user-profile-btn" aria-label="סגור">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  // Add back button handler for mobile
  if (isMobileDevice) {
    const backButton = header.querySelector('.panel-back-button');
    if (backButton) {
      backButton.addEventListener('click', () => {
        closePanel(panel);
      });
    }
  }

  // Content
  const content = document.createElement("div");
  content.className = "user-profile-content";
  content.innerHTML = `
    <div class="user-profile-loading">
      <div class="loader-spinner"></div>
      <p>טוען פרטי משתמש...</p>
    </div>
  `;

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(content);
  
  // On mobile, append to body for fixed positioning
  // On desktop, append to chat area
  if (isMobileDevice) {
    document.body.appendChild(panel);
    // Hide contacts sidebar
    showChatArea();
  } else {
    chatArea.appendChild(panel);
  }

  // Load user info
  loadUserInfo(content);

  // Close button
  const closeBtn = header.querySelector(".close-user-profile-btn");
  closeBtn.addEventListener("click", () => {
    closePanel(panel);
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closePanel(panel);
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

/**
 * Loads user information from API
 */
async function loadUserInfo(contentContainer) {
  try {
    const response = await fetch(`${API_URL}/api/user/info`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userInfo = await response.json();
    renderUserInfo(contentContainer, userInfo);
  } catch (error) {
    console.error("Error loading user info:", error);
    contentContainer.innerHTML = `
      <div class="user-profile-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>שגיאה בטעינת פרטי המשתמש</h3>
        <p>${error.message}</p>
        <button type="button" class="btn btn-retry" onclick="location.reload()">
          נסה שוב
        </button>
      </div>
    `;
  }
}

/**
 * Renders user information
 */
function renderUserInfo(contentContainer, userInfo) {
  const phoneDisplay = userInfo.phoneNumber 
    ? formatIsraeliMobile(userInfo.phoneNumber) 
    : "לא זמין";

  const userIdDisplay = userInfo.userId 
    ? userInfo.userId 
    : "לא זמין";

  const nameDisplay = userInfo.pushname 
    ? userInfo.pushname 
    : "לא הוגדר";

  contentContainer.innerHTML = `
    <div class="user-profile-info">
      <!-- Profile Avatar Section -->
      <div class="profile-avatar-section">
        <div class="profile-avatar">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h3 class="profile-name">${nameDisplay}</h3>
      </div>

      <!-- User Details -->
      <div class="profile-details">
        <div class="profile-detail-item">
          <div class="detail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </div>
          <div class="detail-content">
            <div class="detail-label">מספר טלפון</div>
            <div class="detail-value">${phoneDisplay}</div>
          </div>
        </div>

        <div class="profile-detail-item">
          <div class="detail-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 7a4 4 0 0 1-8 0v4a4 4 0 0 0 8 0V7z"></path>
              <path d="M5 9h14"></path>
              <path d="M19 9v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9"></path>
            </svg>
          </div>
          <div class="detail-content">
            <div class="detail-label">מזהה משתמש (ID)</div>
            <div class="detail-value detail-value-id">${userIdDisplay}</div>
          </div>
        </div>
      </div>

      <!-- Chat Settings -->
      <div class="profile-chat-settings">
        <div class="profile-setting-item">
          <div class="setting-label">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>הצג צ'אט</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="chatEnabledToggle" checked>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Logout Button -->
      <div class="profile-logout-section">
        <button type="button" id="logoutBtn" class="logout-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          התנתק
        </button>
      </div>
    </div>
  `;

  // Load and setup chat enabled toggle
  const chatEnabledToggle = contentContainer.querySelector("#chatEnabledToggle");
  if (chatEnabledToggle) {
    // Load current setting
    loadChatEnabledSetting(chatEnabledToggle);
    
    // Save on change
    chatEnabledToggle.addEventListener("change", async () => {
      const enabled = chatEnabledToggle.checked;
      await saveChatEnabledSetting(enabled);
      // Reload page to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });
  }

  // Add logout button handler
  const logoutBtn = contentContainer.querySelector("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (!confirm("האם אתה בטוח שברצונך להתנתק? זה ימחק את כל קוקיז ההתחברות.")) {
        return;
      }

      try {
        logoutBtn.disabled = true;
        logoutBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          מתנתק...
        `;

        const response = await fetch(`${API_URL}/api/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "omit",
          cache: "no-cache",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        toast.success("התנתקות בוצעה בהצלחה");
        
        // Refresh the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error("Failed to logout", error);
        toast.error(`שגיאה בהתנתקות: ${error.message}`);
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          התנתק
        `;
      }
    });
  }
}

/**
 * Loads chat enabled setting
 */
async function loadChatEnabledSetting(toggleElement) {
  try {
    const response = await fetch(`${API_URL}/api/settings`);
    if (response.ok) {
      const settings = await response.json();
      toggleElement.checked = settings.chatEnabled !== false; // Default to true
    }
  } catch (error) {
    console.error("Error loading chat enabled setting:", error);
    toggleElement.checked = true; // Default to true on error
  }
}

/**
 * Saves chat enabled setting
 */
async function saveChatEnabledSetting(enabled) {
  try {
    const response = await fetch(`${API_URL}/api/settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ chatEnabled: enabled }),
      credentials: "omit",
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error("Failed to save setting");
    }

    toast.success(enabled ? "צ'אט הופעל" : "צ'אט הושבת");
  } catch (error) {
    console.error("Error saving chat enabled setting:", error);
    toast.error("שגיאה בשמירת ההגדרה");
  }
}

/**
 * Closes the panel
 */
function closePanel(panel) {
  // On mobile, remove panel from body
  // On desktop, remove from chat area
  import("../../utils/mobileNavigation.js").then(({ isMobile, showContactsSidebar }) => {
    if (isMobile()) {
      // Remove panel from body
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
      // Show contacts sidebar
      showContactsSidebar();
    } else {
      // Show placeholder instead
      const chatArea = document.querySelector(".chat-area");
      if (chatArea) {
        const chatPlaceholder = document.createElement("div");
        chatPlaceholder.className = "chat-placeholder";
        chatPlaceholder.id = "chatPlaceholder";
        chatPlaceholder.innerHTML = `
          <div class="placeholder-content">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h2>בחר איש קשר כדי להכניס תזכורות</h2>
            <p>התזכורות שלך יופיעו כאן</p>
          </div>
        `;
        chatArea.innerHTML = "";
        chatArea.appendChild(chatPlaceholder);
      }
      
      // Remove panel
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    }
  });
}

