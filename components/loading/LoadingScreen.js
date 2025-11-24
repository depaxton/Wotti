// Loading Screen Component
// Displays a loading screen when session exists but chats are being loaded

/**
 * Creates and returns the loading screen element
 * @returns {HTMLElement} Loading screen container element
 */
export function createLoadingScreen() {
  const container = document.createElement('div');
  container.className = 'loading-screen-container';
  container.id = 'loadingScreenContainer';
  
  container.innerHTML = `
    <div class="loading-screen-content">
      <div class="loading-screen-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <div class="loading-spinner-wrapper">
        <div class="loading-spinner"></div>
      </div>
      <h2 class="loading-screen-title">טוען צ'אטים</h2>
      <p class="loading-screen-message">נא להמתין...</p>
    </div>
  `;

  return container;
}

/**
 * Shows the loading screen
 */
export function showLoadingScreen() {
  const container = document.getElementById('loadingScreenContainer');
  if (container) {
    container.style.display = 'flex';
  }
}

/**
 * Hides the loading screen
 */
export function hideLoadingScreen() {
  const container = document.getElementById('loadingScreenContainer');
  if (container) {
    container.style.display = 'none';
  }
}

