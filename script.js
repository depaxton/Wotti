// Main application entry point

import { renderContacts, initializeContactsSearch } from "./components/contacts/ContactsSidebar.js";
import { initSideMenu } from "./components/menu/SideMenu.js";
import { createQRCodeDisplay } from "./components/qr/QRCodeDisplay.js";
import { createLoadingScreen, showLoadingScreen, hideLoadingScreen } from "./components/loading/LoadingScreen.js";
import { startQRCodePolling, stopQRCodePolling } from "./services/qrService.js";
import { setContacts } from "./services/contactService.js";
import { initHebrewFontDetection } from "./utils/domUtils.js";
import { createUserSettings } from "./components/user/UserSettings.js";

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  renderContacts(); // Render empty/fake contacts initially
  initializeContactsSearch(); // Initialize search functionality
  initSideMenu();
  initQRCodeDisplay();
  initContactsLoader();
  initHebrewFontDetection(); // Initialize Hebrew font detection

  // Verify that loadContacts is available
  if (!window.loadContacts) {
    console.error("loadContacts function not initialized!");
  } else {
    console.log("loadContacts function is ready");
  }

  // Load contacts from JSON immediately on page load (before login)
  loadContactsFromJSON();

  // Listen for contact selection to show reminder interface
  document.addEventListener("contactSelected", (e) => {
    const contact = e.detail.contact;
    const chatArea = document.querySelector(".chat-area");

    if (chatArea) {
      // Clear current content (placeholder, chat, or previous reminder)
      chatArea.innerHTML = "";

      // Render reminder interface
      const userSettings = createUserSettings(contact);
      chatArea.appendChild(userSettings);
    }
  });
});

/**
 * Initializes QR code display in the chat area
 */
function initQRCodeDisplay() {
  const chatPlaceholder = document.getElementById("chatPlaceholder");
  if (!chatPlaceholder) {
    console.error("Chat placeholder not found");
    return;
  }

  // Store original placeholder content
  const originalContent = chatPlaceholder.innerHTML;

  // Create both QR code display and loading screen
  const qrDisplay = createQRCodeDisplay();
  const loadingScreen = createLoadingScreen();

  // Replace placeholder content with both displays
  chatPlaceholder.innerHTML = "";
  chatPlaceholder.appendChild(qrDisplay);
  chatPlaceholder.appendChild(loadingScreen);
  
  // Default: show loading screen, hide QR (will change if QR is needed)
  const qrContainer = document.getElementById("qrCodeContainer");
  if (qrContainer) {
    qrContainer.style.display = "none";
  }
  showLoadingScreen();

  // Start polling for QR code updates
  // Default API URL - adjust if your backend runs on different port
  const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;

  console.log("QR Code Display initialized. API URL:", API_URL);

  // Monitor authentication status and show appropriate screen
  // Track if placeholder has been shown to avoid repeated replacements
  let hasShownPlaceholder = false;
  let isLoadingContacts = false;
  let lastLoadedStatus = null;
  let contactsLoaded = false;
  
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();

      const qrContainer = document.getElementById("qrCodeContainer");
      const loadingContainer = document.getElementById("loadingScreenContainer");

      if (data.status === "ready" || data.status === "authenticated") {
        // Session exists and ready - show loading screen while loading chats
        if (qrContainer) {
          qrContainer.style.display = "none";
          stopQRCodePolling();
        }
        if (loadingContainer) {
          showLoadingScreen();
        }

        // Auto-load contacts when ready (only if not already loaded or status changed)
        // Check if status changed from not-ready to ready, or if contacts haven't been loaded yet
        const statusChangedToReady = lastLoadedStatus !== "ready" && lastLoadedStatus !== "authenticated";
        const shouldLoadContacts = (statusChangedToReady || !contactsLoaded) && !isLoadingContacts;
        
        if (shouldLoadContacts && window.loadContacts) {
          isLoadingContacts = true;
          window.loadContacts().then(() => {
            contactsLoaded = true;
            // After contacts are loaded, show placeholder
            setTimeout(() => {
              if (loadingContainer) {
                hideLoadingScreen();
              }
              if (!hasShownPlaceholder) {
                chatPlaceholder.innerHTML = originalContent;
                hasShownPlaceholder = true;
              }
              isLoadingContacts = false;
            }, 500); // Small delay to ensure contacts are rendered
          }).catch((error) => {
            console.error("Error loading contacts:", error);
            isLoadingContacts = false;
            // Still hide loading screen even if loading failed
            if (loadingContainer) {
              hideLoadingScreen();
            }
          });
        } else if (!isLoadingContacts) {
          // Already loaded, just hide loading screen
          if (loadingContainer) {
            hideLoadingScreen();
          }
        }
        
        // Update last loaded status
        lastLoadedStatus = data.status;
      } else if (data.status === "loading") {
        // Session exists but loading chats - show loading screen, hide QR
        if (qrContainer) {
          qrContainer.style.display = "none";
          stopQRCodePolling();
        }
        if (loadingContainer) {
          showLoadingScreen();
        }
        // Reset contacts loaded flag when status changes to loading
        if (lastLoadedStatus === "ready" || lastLoadedStatus === "authenticated") {
          contactsLoaded = false;
        }
        lastLoadedStatus = data.status;
      } else {
        // No session or needs QR - show QR code, hide loading screen
        // Reset contacts loaded flag when disconnected
        if (lastLoadedStatus === "ready" || lastLoadedStatus === "authenticated") {
          contactsLoaded = false;
          hasShownPlaceholder = false;
        }
        lastLoadedStatus = data.status;
        if (loadingContainer) {
          hideLoadingScreen();
        }
        if (qrContainer) {
          qrContainer.style.display = "block";
          // Make sure QR polling is active
          const { isPollingActive, startQRCodePolling } = await import("./services/qrService.js");
          if (!isPollingActive()) {
            console.log("Status indicates QR needed, starting QR code polling...");
            startQRCodePolling(API_URL);
          }
        } else {
          // QR container was removed, recreate it
          const newQrDisplay = createQRCodeDisplay();
          const loadingContainerCheck = document.getElementById("loadingScreenContainer");
          chatPlaceholder.innerHTML = "";
          chatPlaceholder.appendChild(newQrDisplay);
          chatPlaceholder.appendChild(loadingScreen);
          // Hide loading screen, show QR
          if (loadingContainerCheck) {
            hideLoadingScreen();
          }
          const newQrContainer = document.getElementById("qrCodeContainer");
          if (newQrContainer) {
            newQrContainer.style.display = "block";
          }
          startQRCodePolling(API_URL);
        }
      }
    } catch (error) {
      // Silently fail - server might not be running yet
      console.error("Error checking status:", error);
    }
  };

  // Check status immediately to determine if QR is needed
  checkStatus();
  
  // Check status immediately to determine initial display (QR or loading screen)
  checkStatus();
  
  // Check status every 3 seconds (for QR code and connection status only)
  const statusInterval = setInterval(() => {
    checkStatus().then(() => {
      // Keep checking to detect reconnection needs
      // Don't stop the interval - we need it to detect disconnections
    });
  }, 3000);

  // Check for new messages and reload chats if a message was received
  // This replaces the periodic chat reloading - chats are only reloaded when a message arrives
  const checkNewMessages = async () => {
    try {
      // Only check if client is ready and contacts are already loaded
      if (contactsLoaded && window.loadContacts) {
        const response = await fetch(`${API_URL}/api/messages/new`);
        if (response.ok) {
          const data = await response.json();
          if (data.hasNewMessage) {
            console.log("New message detected, reloading chats...");
            await window.loadContacts();
          }
        }
      }
    } catch (error) {
      // Silently fail - server might not be running or client not ready
      // Don't log errors for this check to avoid console spam
    }
  };

  // Check for new messages every 2 seconds (only after initial load)
  // Start checking after a delay to ensure initial load is complete
  setTimeout(() => {
    const messageCheckInterval = setInterval(checkNewMessages, 2000);
    // Store interval ID for potential cleanup (though we don't need to stop it)
    window.messageCheckInterval = messageCheckInterval;
  }, 5000); // Wait 5 seconds after page load before starting message checks
}

/**
 * Loads contacts from JSON file immediately (no authentication required)
 */
async function loadContactsFromJSON() {
  const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;

  try {
    const response = await fetch(`${API_URL}/api/contacts/json`);

    if (!response.ok) {
      console.warn("Could not load contacts from JSON:", response.statusText);
      return;
    }

    const data = await response.json();

    if (data.contacts && Array.isArray(data.contacts)) {
      // Update contacts in service
      setContacts(data.contacts);

      // Re-render contacts
      renderContacts();

      console.log(`Loaded ${data.contacts.length} contacts from JSON file`);
    }
  } catch (error) {
    console.error("Could not load contacts from JSON:", error.message);
  }
}

/**
 * Initializes contacts loader - manual refresh only
 */
function initContactsLoader() {
  // Default API URL - adjust if your backend runs on different port
  const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;

  // Function to load contacts from API
  const loadContacts = async () => {
    try {
      console.log("Loading contacts from API:", `${API_URL}/api/contacts`);
      const response = await fetch(`${API_URL}/api/contacts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // If client not ready, show error
        if (response.status === 503) {
          const errorText = await response.text();
          console.warn("Client not ready. Please make sure WhatsApp is authenticated.", errorText);
          // Still try to show what we have
          return;
        }
        const errorText = await response.text();
        throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Received data from API:", data);

      if (data.contacts && Array.isArray(data.contacts)) {
        // Update contacts in service
        setContacts(data.contacts);

        // Re-render contacts (preserves current search filter)
        renderContacts();

        console.log(`Successfully loaded ${data.contacts.length} contacts from WhatsApp`);
        return data.contacts.length;
      } else {
        console.warn("No contacts in response or invalid format:", data);
        // Clear contacts if we got an empty response
        setContacts([]);
        renderContacts();
        return 0;
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      // Try to show error to user if possible
      if (error.message && error.message.includes('fetch')) {
        console.error("Network error - make sure the server is running on port 5000");
      }
      throw error; // Re-throw so caller can handle it
    }
  };

  // Expose loadContacts function globally for the refresh button
  window.loadContacts = loadContacts;

  // Setup refresh button handler with retry logic
  const refreshButton = document.getElementById("refreshContactsButton");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      // Add loading state
      refreshButton.disabled = true;
      const buttonIcon = refreshButton.querySelector("svg");
      if (buttonIcon) {
        buttonIcon.style.animation = "spin 1s linear infinite";
      }

      try {
        await loadContacts();
      } catch (error) {
        console.error("Failed to load contacts:", error);
        // Keep button enabled even on error so user can retry
      } finally {
        // Always remove loading state
        refreshButton.disabled = false;
        if (buttonIcon) {
          buttonIcon.style.animation = "";
        }
      }
    });
  } else {
    console.error("Refresh button not found! Make sure the button has id='refreshContactsButton'");
  }
}
