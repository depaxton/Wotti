// Phone number formatting utility functions

/**
 * Formats an Israeli mobile phone number for display
 * Removes the 972 country code prefix and formats with dashes
 * @param {string} phoneNumber - Phone number (can include 972 prefix, dashes, spaces, etc.)
 * @returns {string} Formatted phone number (0XX-XXX-XXXX format)
 */
export function formatIsraeliMobile(phoneNumber) {
  if (!phoneNumber) {
    return "";
  }

  // Remove all non-digit characters
  let digits = phoneNumber.replace(/\D/g, "");

  // Remove 972 country code prefix if present
  if (digits.startsWith("972")) {
    digits = digits.substring(3);
  }

  // Ensure leading 0 is present (for local format)
  if (!digits.startsWith("0")) {
    digits = "0" + digits;
  }

  // Format as 0XX-XXX-XXXX (Israeli mobile format)
  if (digits.length === 10) {
    return `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
  }

  // If not 10 digits, return as is (might be invalid or different format)
  return phoneNumber;
}

