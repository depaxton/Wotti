/**
 * Mobile Navigation Utilities
 * Handles mobile-specific navigation and UI interactions
 */

/**
 * Checks if the current device is mobile
 * @returns {boolean} True if mobile device
 */
export function isMobile() {
  return window.innerWidth <= 768;
}

/**
 * Shows the chat area and hides contacts sidebar on mobile
 */
export function showChatArea() {
  if (!isMobile()) return;
  
  const contactsSidebar = document.querySelector(".contacts-sidebar");
  const chatArea = document.querySelector(".chat-area");
  
  if (contactsSidebar) {
    contactsSidebar.classList.add("hidden");
  }
  
  if (chatArea) {
    chatArea.classList.add("active");
  }
}

/**
 * Hides the chat area and shows contacts sidebar on mobile
 */
export function showContactsSidebar() {
  if (!isMobile()) return;
  
  const contactsSidebar = document.querySelector(".contacts-sidebar");
  const chatArea = document.querySelector(".chat-area");
  
  if (contactsSidebar) {
    contactsSidebar.classList.remove("hidden");
  }
  
  if (chatArea) {
    chatArea.classList.remove("active");
  }
}

/**
 * Creates a mobile back button
 * @param {Function} onClick - Callback function when back button is clicked
 * @returns {HTMLElement} Back button element
 */
export function createMobileBackButton(onClick) {
  const backButton = document.createElement("button");
  backButton.className = "mobile-back-button";
  backButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
    חזרה
  `;
  
  backButton.addEventListener("click", () => {
    onClick();
    showContactsSidebar();
  });
  
  return backButton;
}

/**
 * Adds mobile back button to chat header
 */
export function addMobileBackButtonToChat() {
  if (!isMobile()) return;
  
  const chatHeader = document.querySelector(".chat-header");
  if (!chatHeader) return;
  
  // Check if back button already exists
  if (chatHeader.querySelector(".mobile-back-button")) return;
  
  const backButton = createMobileBackButton(() => {
    // Clear chat area content when going back
    const chatArea = document.querySelector(".chat-area");
    if (chatArea) {
      const placeholder = document.getElementById("chatPlaceholder");
      if (placeholder) {
        chatArea.innerHTML = `
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
      }
    }
  });
  
  // Insert at the beginning of chat header
  chatHeader.insertBefore(backButton, chatHeader.firstChild);
}

/**
 * Handles window resize to adjust mobile navigation
 */
export function handleMobileResize() {
  // If window is resized to desktop, remove mobile classes
  if (!isMobile()) {
    const contactsSidebar = document.querySelector(".contacts-sidebar");
    const chatArea = document.querySelector(".chat-area");
    
    if (contactsSidebar) {
      contactsSidebar.classList.remove("hidden");
    }
    
    if (chatArea) {
      chatArea.classList.remove("active");
    }
  }
}

/**
 * Initializes mobile navigation
 */
export function initMobileNavigation() {
  // Listen for window resize
  window.addEventListener("resize", handleMobileResize);
  
  // Handle initial mobile state
  handleMobileResize();
}

