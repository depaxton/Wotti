// Chat Area Component
// Main component that combines all chat functionality

import { createChatHeader, cleanupChatHeader } from "./ChatHeader.js";
import { createMessageBubble } from "./MessageBubble.js";
import { createChatInput } from "./ChatInput.js";
import { createChatSearch } from "./ChatSearch.js";
import { applyHebrewFont } from "../../utils/domUtils.js";
import { createReminderInterface } from "../reminder/ReminderInterface.js";
import { isDifferentDay, formatDateDivider } from "../../services/chatService.js";
import { fetchWithETagSmart } from "../../utils/etagCache.js";

let currentChatId = null;
let isLoadingMessages = false;
let hasMoreMessages = true;
let oldestMessageId = null;
let messagesContainer = null;
let messages = [];
let chatSearch = null;
let searchQuery = "";
let chatUpdateInterval = null;
let isInitialLoad = true; // Track if this is the first load of the chat
let messageIdSet = new Set(); // Track known message IDs to avoid duplicates
let loadOlderButton = null; // Reference to the "Load Older" button
let renderedMessageIds = new Set(); // Track which message IDs are already rendered in DOM
let shouldFullRender = true; // Flag to determine if we should do a full render
let currentLimit = 50; // Current limit for loading messages (starts at 50, increases by 50 each time, max 1000)

/**
 * Creates and displays chat area for a contact
 * @param {Object} contact - Contact object
 */
export function createChatArea(contact) {
  const chatArea = document.querySelector(".chat-area");
  if (!chatArea) return;

  // Cleanup previous chat
  cleanupChatHeader();

  currentChatId = contact.id;
  messages = [];
  hasMoreMessages = true;
  oldestMessageId = null;
  searchQuery = "";
  isInitialLoad = true; // Reset for new chat
  messageIdSet = new Set();
  renderedMessageIds = new Set();
  shouldFullRender = true;
  currentLimit = 50; // Reset limit for new chat

  chatArea.innerHTML = `
    <div class="split-container">
      <div class="split-panel reminder-panel">
        <div id="reminderContainer"></div>
      </div>
      <div class="split-panel chat-panel">
        <div class="chat-container">
          <div class="chat-toolbar">
            <button class="chat-toolbar-btn" id="chatSearchBtn" title="חפש בצ'אט">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </button>
          </div>
          <div id="chatHeaderContainer"></div>
          <div class="chat-messages" id="chatMessages">
            <div class="messages-loading">טוען הודעות...</div>
          </div>
          <div id="chatInputContainer"></div>
          <div id="chatSearchContainer"></div>
        </div>
      </div>
    </div>
  `;

  // Create reminder interface in left panel
  const reminderContainer = document.getElementById("reminderContainer");
  if (reminderContainer) {
    const reminderInterface = createReminderInterface(contact);
    reminderContainer.appendChild(reminderInterface);
  }

  // Create components
  const headerContainer = document.getElementById("chatHeaderContainer");
  const header = createChatHeader(contact);
  headerContainer.appendChild(header);

  messagesContainer = document.getElementById("chatMessages");

  const inputContainer = document.getElementById("chatInputContainer");
  const chatInput = createChatInput(currentChatId, () => {
    // Reload messages after sending
    setTimeout(() => {
      loadMessages(false, true, false); // Reload latest messages and scroll to bottom
    }, 500);
  });
  inputContainer.appendChild(chatInput);

  // Create search component
  const searchContainer = document.getElementById("chatSearchContainer");
  chatSearch = createChatSearch(currentChatId, (searchMessages, scrollToMessageId) => {
    if (scrollToMessageId) {
      // Scroll to specific message
      scrollToMessage(scrollToMessageId);
    } else if (searchMessages && searchMessages.length > 0) {
      // Highlight search results in messages - need full render for highlighting
      const newSearchQuery = document.getElementById("chatSearchInput")?.value || "";
      if (newSearchQuery !== searchQuery) {
        searchQuery = newSearchQuery;
        shouldFullRender = true; // Force full render to apply search highlighting
        renderMessages(null);
      }
    }
  });
  searchContainer.appendChild(chatSearch);

  // Setup search button
  const searchBtn = document.getElementById("chatSearchBtn");
  searchBtn?.addEventListener("click", () => {
    chatSearch.show();
  });

  // Load initial messages
  loadMessages();

  // Setup infinite scroll
  setupInfiniteScroll();

  // Start periodic chat updates (every 2 seconds)
  startChatUpdates();
}

/**
 * Loads messages from server
 * @param {boolean} loadOlder - Whether to load older messages (increase limit and reload)
 * @param {boolean} scrollToBottom - Whether to scroll to bottom after loading
 * @param {boolean} isUpdateCheck - Whether this is a periodic update check (don't scroll if user scrolled up)
 */
async function loadMessages(loadOlder = false, scrollToBottom = false, isUpdateCheck = false) {
  if (isLoadingMessages) return;

  // If loading older messages, increase limit (max 1000)
  if (loadOlder) {
    if (currentLimit >= 1000) {
      // Already at max limit, no more messages to load
      hasMoreMessages = false;
      return;
    }
    currentLimit = Math.min(currentLimit + 50, 1000);
  }

  isLoadingMessages = true;
  const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;

  // Remove load older button and show loading indicator when loading older messages
  let loadingIndicator = null;
  if (loadOlder && messagesContainer) {
    // Remove the load older button before loading
    if (loadOlderButton && loadOlderButton.parentNode) {
      loadOlderButton.remove();
      loadOlderButton = null;
    }

    loadingIndicator = document.createElement("div");
    loadingIndicator.className = "messages-loading-older";
    loadingIndicator.innerHTML = '<div class="loading-spinner"></div> <span>טוען הודעות ישנות...</span>';
    loadingIndicator.style.textAlign = "center";
    loadingIndicator.style.padding = "10px";
    loadingIndicator.style.color = "var(--color-medium-grey)";
    messagesContainer.insertBefore(loadingIndicator, messagesContainer.firstChild);
  }

  try {
    const url = `${API_URL}/api/chat/${currentChatId}/messages?limit=${currentLimit}`;

    // השתמש ב-ETag רק עבור polling (update checks) - לא עבור טעינה ראשונית או טעינת הודעות ישנות
    let data;
    if (isUpdateCheck && !loadOlder) {
      // זה polling - השתמש ב-ETag
      const result = await fetchWithETagSmart(url);
      
      // אם הנתונים לא השתנו (304), אין הודעות חדשות
      if (!result.changed) {
        isLoadingMessages = false;
        return; // אין צורך לעדכן את ה-UI
      }
      
      if (!result.data) {
        throw new Error("Failed to load messages");
      }
      
      data = result.data;
    } else {
      // זה טעינה ראשונית או טעינת הודעות ישנות - לא להשתמש ב-ETag
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load messages");
      data = await response.json();
    }
    hasMoreMessages = data.messages.length === currentLimit && currentLimit < 1000;

    // Remove loading indicator
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }

    if (loadOlder) {
      // When loading older messages, reload all messages with new limit
      // Save scroll position to restore it after reload
      const previousScrollTop = messagesContainer.scrollTop;
      const previousScrollHeight = messagesContainer.scrollHeight;

      // Replace all messages with new set (includes older messages)
      messages = sortMessagesAscending(data.messages || []);
      messageIdSet = new Set(messages.map((msg) => msg.id));
      renderedMessageIds = new Set();
      shouldFullRender = true;

      // Render all messages
      renderMessages(null);

      // Restore scroll position (adjust for new content height)
      requestAnimationFrame(() => {
        const newScrollHeight = messagesContainer.scrollHeight;
        const heightDifference = newScrollHeight - previousScrollHeight;
        messagesContainer.scrollTop = previousScrollTop + heightDifference;
      });

      oldestMessageId = messages[0]?.id || null;
    } else {
      handleLatestMessages(data.messages, scrollToBottom, isUpdateCheck);
    }
  } catch (error) {
    console.error("Error loading messages:", error);

    // Remove loading indicator on error
    if (loadingIndicator && loadingIndicator.parentNode) {
      loadingIndicator.remove();
    }

    if (messagesContainer && !loadOlder) {
      // Only show error for initial load, not for loading older messages
      messagesContainer.innerHTML = '<div class="messages-error">שגיאה בטעינת הודעות</div>';
    }
  } finally {
    isLoadingMessages = false;
    // Update button visibility after loading completes (success or error)
    if (loadOlder) {
      setTimeout(() => updateLoadOlderButton(), 100);
    }
  }
}

/**
 * Returns a new array of messages sorted from oldest to newest
 * @param {Array} messageList - List of messages
 * @returns {Array} Sorted list
 */
function sortMessagesAscending(messageList) {
  return [...messageList].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Handles latest messages (initial load or update check)
 * @param {Array} fetchedMessages - Messages loaded from API
 * @param {boolean} scrollToBottomFlag - Should scroll to bottom after rendering
 * @param {boolean} isUpdateCheck - Whether this is a periodic update check
 */
function handleLatestMessages(fetchedMessages, scrollToBottomFlag, isUpdateCheck) {
  if (!messagesContainer) return;

  const previousScrollTop = messagesContainer.scrollTop;
  const wasAtBottom = isAtBottom();
  const sortedMessages = sortMessagesAscending(fetchedMessages || []);

  let newMessagesAdded = false;
  if (messages.length === 0) {
    // Initial load - full render
    messages = sortedMessages;
    messageIdSet = new Set(messages.map((msg) => msg.id));
    renderedMessageIds = new Set();
    shouldFullRender = true;
    newMessagesAdded = messages.length > 0;
  } else {
    // Update check - only add new messages
    const uniqueNewMessages = sortedMessages.filter((msg) => !messageIdSet.has(msg.id));
    if (uniqueNewMessages.length > 0) {
      messages = [...messages, ...uniqueNewMessages];
      uniqueNewMessages.forEach((msg) => messageIdSet.add(msg.id));
      shouldFullRender = false; // Only render new messages
      newMessagesAdded = true;
      // Pass only the new messages that aren't rendered yet
      renderMessages(uniqueNewMessages);
    } else {
      // No new messages - don't re-render at all
      shouldFullRender = false;
      return;
    }
    return; // Exit early since renderMessages was already called
  }

  // Initial load - full render
  renderMessages(null);

  const shouldScrollToBottom = isInitialLoad || scrollToBottomFlag || (isUpdateCheck && wasAtBottom && newMessagesAdded);
  if (shouldScrollToBottom) {
    requestAnimationFrame(() => scrollToBottom());
  } else {
    messagesContainer.scrollTop = previousScrollTop;
  }

  isInitialLoad = false;
  oldestMessageId = messages[0]?.id || null;
}

// Note: prependOlderMessages function removed - we now reload all messages with increased limit

/**
 * Creates a date divider element
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {HTMLElement} Date divider element
 */
function createDateDivider(timestamp) {
  const divider = document.createElement("div");
  divider.className = "date-divider";
  divider.innerHTML = `<span class="date-divider-text">${formatDateDivider(timestamp)}</span>`;
  return divider;
}

/**
 * Renders messages efficiently - only renders new messages if full render is not needed
 * @param {Array|null} newMessagesOnly - If provided, only these messages will be added (for incremental updates)
 */
function renderMessages(newMessagesOnly = null) {
  if (!messagesContainer) return;

  if (messages.length === 0) {
    messagesContainer.innerHTML = '<div class="messages-empty">אין הודעות</div>';
    renderedMessageIds.clear();
    return;
  }

  // Full render - initial load, when search query changes, or when explicitly requested
  if (shouldFullRender || newMessagesOnly === null) {
    // Store current scroll position
    const scrollPosition = messagesContainer.scrollTop;
    const scrollHeight = messagesContainer.scrollHeight;
    const wasAtBottom = isAtBottom();

    // Clear and render all messages with date dividers
    const fragment = document.createDocumentFragment();

    messages.forEach((msg, index) => {
      // Check if we need to add a date divider before this message
      if (index === 0 || isDifferentDay(messages[index - 1].timestamp, msg.timestamp)) {
        const divider = createDateDivider(msg.timestamp);
        fragment.appendChild(divider);
      }

      const bubble = createMessageBubble(msg, searchQuery);
      renderedMessageIds.add(msg.id);
      fragment.appendChild(bubble);
    });

    messagesContainer.innerHTML = "";
    messagesContainer.appendChild(fragment);

    // Restore scroll position if not at bottom
    if (!wasAtBottom && scrollHeight > 0) {
      const newScrollHeight = messagesContainer.scrollHeight;
      const heightDifference = newScrollHeight - scrollHeight;
      messagesContainer.scrollTop = scrollPosition + heightDifference;
    }

    shouldFullRender = false;
  } else if (newMessagesOnly && newMessagesOnly.length > 0) {
    // Incremental render - only add new messages at the bottom
    const fragment = document.createDocumentFragment();

    // Get the last rendered message to check if we need a date divider
    const lastRenderedMessage = messages.length > newMessagesOnly.length ? messages[messages.length - newMessagesOnly.length - 1] : null;

    newMessagesOnly.forEach((msg, index) => {
      if (!renderedMessageIds.has(msg.id)) {
        // Check if we need to add a date divider before this message
        const previousMessage = index > 0 ? newMessagesOnly[index - 1] : lastRenderedMessage;
        if (!previousMessage || isDifferentDay(previousMessage.timestamp, msg.timestamp)) {
          const divider = createDateDivider(msg.timestamp);
          fragment.appendChild(divider);
        }

        const bubble = createMessageBubble(msg, searchQuery);
        renderedMessageIds.add(msg.id);
        fragment.appendChild(bubble);
      }
    });

    // Append new messages to container
    if (fragment.children.length > 0) {
      messagesContainer.appendChild(fragment);
      // Apply Hebrew font detection to new messages after they're in DOM
      // Convert fragment children to array since fragment doesn't stay in DOM
      Array.from(fragment.children).forEach((child) => {
        applyHebrewFont(child);
      });
    }
  } else {
    // Full render - apply Hebrew font detection to entire container
    applyHebrewFont(messagesContainer);
  }

  // Update load older button visibility
  updateLoadOlderButton();
}

/**
 * Scrolls to bottom of messages
 */
function scrollToBottom() {
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

/**
 * Checks if user is at the bottom of the messages container
 * @returns {boolean} True if at bottom (within 100px threshold)
 */
function isAtBottom() {
  if (!messagesContainer) return false;
  const threshold = 100;
  return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < threshold;
}

/**
 * Starts periodic chat updates (every 2 seconds)
 */
function startChatUpdates() {
  // Clear any existing interval
  if (chatUpdateInterval) {
    clearInterval(chatUpdateInterval);
  }

  // Check for updates every 2 seconds
  chatUpdateInterval = setInterval(() => {
    if (currentChatId && messagesContainer) {
      // Check for new messages (update check - won't scroll if user scrolled up)
      loadMessages(false, false, true);
    }
  }, 2000);
}

/**
 * Stops periodic chat updates
 */
function stopChatUpdates() {
  if (chatUpdateInterval) {
    clearInterval(chatUpdateInterval);
    chatUpdateInterval = null;
  }
}

/**
 * Scrolls to a specific message
 * @param {string} messageId - Message ID to scroll to
 */
function scrollToMessage(messageId) {
  if (!messagesContainer) return;

  const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

    // Highlight message briefly
    messageElement.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
    setTimeout(() => {
      messageElement.style.backgroundColor = "";
    }, 2000);
  }
}

/**
 * Sets up scroll listener for infinite scroll - automatically loads more messages when reaching top
 */
function setupInfiniteScroll() {
  if (!messagesContainer) return;

  let scrollTimeout = null;

  messagesContainer.addEventListener("scroll", () => {
    // Debounce scroll events
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }

    scrollTimeout = setTimeout(() => {
      // Check if user scrolled to the top (within 200px threshold)
      const isNearTop = messagesContainer.scrollTop < 200;

      // If near top, has more messages, and not currently loading, automatically load older messages
      if (isNearTop && hasMoreMessages && !isLoadingMessages && currentLimit < 1000) {
        loadMessages(true, false, false); // Load older messages (increase limit)
      } else {
        // Update button visibility based on scroll position (fallback if auto-load fails)
        updateLoadOlderButton();
      }
    }, 100); // 100ms debounce
  });
}

/**
 * Updates the visibility of the "Load Older" button (fallback if auto-load doesn't work)
 */
function updateLoadOlderButton() {
  if (!messagesContainer) return;

  // Remove existing button if present
  if (loadOlderButton && loadOlderButton.parentNode) {
    loadOlderButton.remove();
    loadOlderButton = null;
  }

  // Show button only if there are more messages (limit < 1000) and not loading
  // This is a fallback - normally auto-load should handle it
  if (hasMoreMessages && currentLimit < 1000 && !isLoadingMessages) {
    // Check if user is near the top (within 300px) and auto-load didn't trigger
    const isNearTop = messagesContainer.scrollTop < 300;

    if (isNearTop) {
      loadOlderButton = document.createElement("button");
      loadOlderButton.className = "load-older-messages-btn";
      loadOlderButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
        <span>טען הודעות ישנות</span>
      `;
      loadOlderButton.addEventListener("click", () => {
        if (!isLoadingMessages) {
          loadMessages(true, false, false); // Load older messages (increase limit)
        }
      });

      // Insert at the top of messages container
      messagesContainer.insertBefore(loadOlderButton, messagesContainer.firstChild);
    }
  }
}

/**
 * Cleans up chat area
 */
export function cleanupChatArea() {
  cleanupChatHeader();
  stopChatUpdates();
  currentChatId = null;
  messages = [];
  hasMoreMessages = true;
  oldestMessageId = null;
  messagesContainer = null;
  chatSearch = null;
  searchQuery = "";
  isInitialLoad = true;
  messageIdSet = new Set();
  renderedMessageIds = new Set();
  shouldFullRender = true;
  currentLimit = 50; // Reset limit
  if (loadOlderButton) {
    loadOlderButton = null;
  }
}
