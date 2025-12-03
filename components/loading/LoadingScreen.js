// Loading Screen Component
// Displays a loading screen when session exists but chats are being loaded

import { createLoadingProgressBar, startProgressBar, stopProgressBar, completeProgressBar } from './LoadingProgressBar.js';

let progressBarCleanup = null;
let isShowing = false; // Track if loading screen is currently visible

/**
 * Creates and returns the loading screen element
 * @returns {HTMLElement} Loading screen container element
 */
export function createLoadingScreen() {
  const container = document.createElement('div');
  container.className = 'loading-screen-container';
  container.id = 'loadingScreenContainer';
  
  // Create progress bar
  const progressBar = createLoadingProgressBar();
  
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

  // Append progress bar to content
  const content = container.querySelector('.loading-screen-content');
  if (content) {
    content.appendChild(progressBar);
  }

  return container;
}

/**
 * Shows the loading screen and starts the progress bar animation
 */
export function showLoadingScreen() {
  const container = document.getElementById('loadingScreenContainer');
  if (container) {
    // Only show and start animation if not already showing
    if (!isShowing) {
      container.style.display = 'flex';
      isShowing = true;
      // Start progress bar animation only if not already running
      if (!progressBarCleanup) {
        progressBarCleanup = startProgressBar();
      }
    }
  }
}

/**
 * Hides the loading screen and stops the progress bar animation
 */
export function hideLoadingScreen() {
  const container = document.getElementById('loadingScreenContainer');
  if (container) {
    container.style.display = 'none';
    isShowing = false; // Reset flag
    // Stop and reset progress bar
    if (progressBarCleanup) {
      progressBarCleanup();
      progressBarCleanup = null;
    }
    stopProgressBar();
  }
}

/**
 * Completes the progress bar (sets to 100%) before hiding
 * Useful when loading is actually complete
 */
export function completeAndHideLoadingScreen() {
  completeProgressBar();
  // Wait a moment to show completion, then hide
  setTimeout(() => {
    hideLoadingScreen();
  }, 500);
}

