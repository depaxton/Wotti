// DOM manipulation utility functions

/**
 * Removes active class from all elements matching the selector
 * @param {string} selector - CSS selector for elements
 */
export function removeActiveClass(selector) {
  document.querySelectorAll(selector).forEach((item) => {
    item.classList.remove("active");
  });
}

/**
 * Adds active class to a specific element
 * @param {HTMLElement} element - Element to add active class to
 */
export function addActiveClass(element) {
  element.classList.add("active");
}

/**
 * Checks if a string contains Hebrew characters
 * @param {string} text - Text to check
 * @returns {boolean} True if text contains Hebrew characters
 */
export function containsHebrew(text) {
  if (!text || typeof text !== 'string') return false;
  // Hebrew Unicode range: U+0590 to U+05FF and U+FB1D to U+FB4F
  const hebrewRegex = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
  return hebrewRegex.test(text);
}

/**
 * Applies Hebrew font styling to elements containing Hebrew text
 * @param {HTMLElement|NodeList|string} elements - Element(s) to process (can be a single element, NodeList, or CSS selector)
 */
export function applyHebrewFont(elements) {
  let elementList;
  
  if (typeof elements === 'string') {
    elementList = document.querySelectorAll(elements);
  } else if (elements instanceof NodeList || Array.isArray(elements)) {
    elementList = elements;
  } else if (elements instanceof HTMLElement) {
    elementList = [elements];
  } else {
    return;
  }

  elementList.forEach((element) => {
    // Skip if already processed
    if (element.dataset.hebrewProcessed === 'true') {
      return;
    }
    
    // Check if element itself contains Hebrew text
    if (element.textContent && containsHebrew(element.textContent)) {
      // Check all child text nodes and wrap Hebrew text
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (containsHebrew(node.textContent)) {
          textNodes.push(node);
        }
      }
      
      // Wrap Hebrew text nodes in spans
      textNodes.forEach((textNode) => {
        const parent = textNode.parentElement;
        if (parent && !parent.classList.contains('hebrew-text')) {
          const span = document.createElement('span');
          span.className = 'hebrew-text';
          parent.insertBefore(span, textNode);
          span.appendChild(textNode);
        }
      });
      
      // Mark as processed
      element.dataset.hebrewProcessed = 'true';
    }
  });
}

/**
 * Initializes Hebrew font detection for the entire document
 * Uses MutationObserver to automatically apply Hebrew font to dynamically added content
 */
export function initHebrewFontDetection() {
  // Apply to existing content
  applyHebrewFont(document.body);
  
  // Watch for new content being added
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          applyHebrewFont(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

