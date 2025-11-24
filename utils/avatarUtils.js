// Avatar utility functions

/**
 * Generates avatar color for a contact based on their index
 * Cycles through 3 shades of green sequentially (1,2,3,1,2,3...)
 * Uses 3 shades of green from CSS root variables
 * @param {number} index - Contact index (0-based)
 * @returns {string} Color value from CSS variables
 */
export function getAvatarColor(index) {
  // Get root CSS variables for the 3 green shades
  const rootStyles = getComputedStyle(document.documentElement);
  const greenLight = rootStyles.getPropertyValue("--color-green-light").trim();
  const greenMedium = rootStyles.getPropertyValue("--color-green-medium").trim();
  const greenDark = rootStyles.getPropertyValue("--color-green-dark").trim();

  // Cycle through the 3 shades of green sequentially: 1,2,3,1,2,3...
  const greenShades = [greenLight, greenMedium, greenDark];
  const shadeIndex = index % greenShades.length;
  return greenShades[shadeIndex];
}

/**
 * Gets the SVG icon for contact avatar (white outline person icon)
 * Uses a free icon style - outline/stroke only, no fill
 * @returns {string} SVG icon HTML
 */
export function getContactIcon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

