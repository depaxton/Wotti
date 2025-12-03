// Chat Input Component
// Handles message input and sending

/**
 * Creates chat input component
 * @param {string} chatId - Chat ID to send messages to
 * @param {Function} onMessageSent - Callback when message is sent
 * @returns {HTMLElement} Chat input element
 */
export function createChatInput(chatId, onMessageSent) {
  const container = document.createElement('div');
  container.className = 'chat-input-container';
  
  container.innerHTML = `
    <button class="chat-attach-button" type="button" title="צרף קובץ" id="chatAttachBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
      </svg>
    </button>
    <input type="text" id="chatInput" class="chat-input" placeholder="הקלד הודעה..." autocomplete="off" />
    <button class="chat-send-button" type="button" title="שלח" id="chatSendBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  `;
  
  const input = container.querySelector('#chatInput');
  const sendBtn = container.querySelector('#chatSendBtn');
  const attachBtn = container.querySelector('#chatAttachBtn');
  
  // Send message function
  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text || !chatId) return;
    
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    
    try {
      const API_URL = window.location.hostname === "localhost" ? "http://localhost:5000" : `${window.location.protocol}//${window.location.hostname}:5000`;
      const response = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: text }),
      });
      
      if (response.ok) {
        if (onMessageSent) {
          onMessageSent();
        }
      } else {
        const error = await response.json();
        alert('שגיאה בשליחת ההודעה: ' + (error.error || 'Unknown error'));
        input.value = text; // Restore text on error
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('שגיאה בשליחת ההודעה');
      input.value = text; // Restore text on error
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  };
  
  // Send on button click
  sendBtn.addEventListener('click', sendMessage);
  
  // Send on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Attach file (placeholder for future implementation)
  attachBtn.addEventListener('click', () => {
    // TODO: Implement file attachment
    alert('צירוף קבצים יושם בקרוב');
  });
  
  // Focus input on mount
  setTimeout(() => input.focus(), 100);
  
  return container;
}

