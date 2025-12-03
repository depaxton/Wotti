// Chat Search Component
// Handles searching within a chat

import { escapeHtml, formatMessageTime } from '../../services/chatService.js';

/**
 * Creates chat search component
 * @param {string} chatId - Chat ID to search in
 * @param {Function} onSearchResults - Callback with search results
 * @returns {HTMLElement} Chat search element
 */
export function createChatSearch(chatId, onSearchResults) {
  const container = document.createElement('div');
  container.className = 'chat-search-container';
  container.style.display = 'none'; // Hidden by default
  
  container.innerHTML = `
    <div class="chat-search-input-wrapper">
      <input type="text" id="chatSearchInput" class="chat-search-input" placeholder="חפש בצ'אט..." autocomplete="off" />
      <button class="chat-search-close" type="button" title="סגור חיפוש" id="chatSearchClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="chat-search-results" id="chatSearchResults"></div>
  `;
  
  const searchInput = container.querySelector('#chatSearchInput');
  const searchClose = container.querySelector('#chatSearchClose');
  const searchResults = container.querySelector('#chatSearchResults');
  let searchTimeout = null;
  
  // Search function
  const performSearch = async (query) => {
    if (!query || query.length < 2) {
      searchResults.innerHTML = '';
      if (onSearchResults) {
        onSearchResults([]);
      }
      return;
    }
    
    try {
      const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;
      const response = await fetch(`${API_URL}/api/chat/${chatId}/search?query=${encodeURIComponent(query)}&limit=50`);
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      
      if (data.messages && data.messages.length > 0) {
        searchResults.innerHTML = `
          <div class="search-results-header">נמצאו ${data.messages.length} הודעות</div>
          <div class="search-results-list">
            ${data.messages.map(msg => `
              <div class="search-result-item" data-message-id="${msg.id}">
                <div class="search-result-text">${escapeHtml(msg.body)}</div>
                <div class="search-result-time">${formatMessageTime(msg.timestamp)}</div>
              </div>
            `).join('')}
          </div>
        `;
        
        // Add click handlers to search results
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const messageId = item.dataset.messageId;
            if (onSearchResults) {
              onSearchResults(data.messages, messageId);
            }
          });
        });
      } else {
        searchResults.innerHTML = '<div class="search-no-results">לא נמצאו תוצאות</div>';
      }
      
      if (onSearchResults) {
        onSearchResults(data.messages || []);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
      searchResults.innerHTML = '<div class="search-error">שגיאה בחיפוש</div>';
    }
  };
  
  // Search on input with debounce
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300); // 300ms debounce
  });
  
  // Close search
  searchClose.addEventListener('click', () => {
    container.style.display = 'none';
    searchInput.value = '';
    searchResults.innerHTML = '';
  });
  
  // Show search
  const show = () => {
    container.style.display = 'block';
    setTimeout(() => searchInput.focus(), 100);
  };
  
  // Hide search
  const hide = () => {
    container.style.display = 'none';
    searchInput.value = '';
    searchResults.innerHTML = '';
  };
  
  // Expose show/hide methods
  container.show = show;
  container.hide = hide;
  
  return container;
}

