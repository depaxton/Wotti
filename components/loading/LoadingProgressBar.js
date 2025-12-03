// Loading Progress Bar Component
// Manages the progress bar animation for chat loading screen

/**
 * Creates and returns a progress bar element with advanced animation logic
 * @returns {HTMLElement} Progress bar container element
 */
export function createLoadingProgressBar() {
  const container = document.createElement('div');
  container.className = 'loading-progress-container';
  container.id = 'loadingProgressContainer';
  
  container.innerHTML = `
    <div class="loading-progress-bar-wrapper">
      <div class="loading-progress-bar" id="loadingProgressBar">
        <div class="loading-progress-fill" id="loadingProgressFill"></div>
      </div>
      <div class="loading-progress-text" id="loadingProgressText">0%</div>
    </div>
    <div class="loading-error-message" id="loadingErrorMessage" style="display: none;">
      שגיאה יש לרענן את הדף
    </div>
  `;

  return container;
}

/**
 * Starts the progress bar animation with the specified timing
 * - Fast start: 0% to 60% in 3 seconds
 * - Slow finish: 60% to 100% in 120 seconds (total 123 seconds)
 * - Error detection: If stuck at 100% for more than 7 seconds, show error
 */
export function startProgressBar() {
  const progressFill = document.getElementById('loadingProgressFill');
  const progressText = document.getElementById('loadingProgressText');
  const errorMessage = document.getElementById('loadingErrorMessage');
  
  if (!progressFill || !progressText) {
    console.error('Progress bar elements not found');
    return;
  }

  // Reset state
  progressFill.style.width = '0%';
  progressText.textContent = '0%';
  if (errorMessage) {
    errorMessage.style.display = 'none';
  }

  let currentProgress = 0;
  const startTime = Date.now();
  let reached100Time = null;
  let errorTimeout = null;

  // Phase 1: Fast start - 0% to 60% in 3 seconds
  const phase1Duration = 3000; // 3 seconds
  const phase1Target = 60; // 60%

  // Phase 2: Slow finish - 60% to 100% in 117 seconds (total 120 seconds)
  const phase2Duration = 117000; // 117 seconds (120 - 3)
  const phase2Target = 100; // 100%

  let animationFrameId = null;

  const updateProgress = () => {
    const elapsed = Date.now() - startTime;

    if (elapsed < phase1Duration) {
      // Phase 1: Fast start (0% to 60%)
      currentProgress = Math.min(phase1Target, (elapsed / phase1Duration) * phase1Target);
    } else if (elapsed < phase1Duration + phase2Duration) {
      // Phase 2: Slow finish (60% to 100%)
      const phase2Elapsed = elapsed - phase1Duration;
      const phase2Progress = (phase2Elapsed / phase2Duration) * (phase2Target - phase1Target);
      currentProgress = phase1Target + phase2Progress;
    } else {
      // Reached 100%
      currentProgress = 100;
      
      // Track when we first reached 100%
      if (reached100Time === null) {
        reached100Time = Date.now();
        
        // Set timeout to show error if stuck at 100% for more than 7 seconds
        errorTimeout = setTimeout(() => {
          if (errorMessage) {
            errorMessage.style.display = 'block';
          }
        }, 7000); // 7 seconds
      }
    }

    // Update UI
    const roundedProgress = Math.round(currentProgress);
    progressFill.style.width = `${currentProgress}%`;
    progressText.textContent = `${roundedProgress}%`;

    // Continue animation
    animationFrameId = requestAnimationFrame(updateProgress);
  };

  // Start animation
  animationFrameId = requestAnimationFrame(updateProgress);

  // Return cleanup function
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
  };
}

/**
 * Stops the progress bar animation and resets it
 */
export function stopProgressBar() {
  const progressFill = document.getElementById('loadingProgressFill');
  const progressText = document.getElementById('loadingProgressText');
  const errorMessage = document.getElementById('loadingErrorMessage');
  
  if (progressFill) {
    progressFill.style.width = '0%';
  }
  if (progressText) {
    progressText.textContent = '0%';
  }
  if (errorMessage) {
    errorMessage.style.display = 'none';
  }
}

/**
 * Completes the progress bar immediately (sets to 100%)
 */
export function completeProgressBar() {
  const progressFill = document.getElementById('loadingProgressFill');
  const progressText = document.getElementById('loadingProgressText');
  const errorMessage = document.getElementById('loadingErrorMessage');
  
  if (progressFill) {
    progressFill.style.width = '100%';
  }
  if (progressText) {
    progressText.textContent = '100%';
  }
  if (errorMessage) {
    errorMessage.style.display = 'none';
  }
}

