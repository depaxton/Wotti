// Chat Placeholder Component

/**
 * Creates and returns the chat placeholder element
 * @returns {HTMLElement} Chat placeholder element
 */
export function createChatPlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "chat-placeholder";

  placeholder.innerHTML = `
    <div class="placeholder-content">
      <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <h2>בחר איש קשר כדי להכניס תזכורות</h2>
      <p>התזכורות שלך יופיעו כאן</p>
    </div>
  `;

  return placeholder;
}
