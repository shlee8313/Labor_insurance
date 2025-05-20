//file: lib/utils/formattingUtils.js
/**
 * Formatting utility functions for the 4대보험 (Four Major Insurance) management system
 */

/**
 * Format a resident registration number with a hyphen
 * @param {string} residentNumber - Resident registration number (13 digits)
 * @returns {string} Formatted resident number (123456-1234567)
 */
export const formatResidentNumber = (residentNumber) => {
  if (!residentNumber) return "";
  // Format as 123456-1234567
  return residentNumber.replace(/^(\d{6})(\d{7})$/, "$1-$2");
};

/**
 * Format a phone number with hyphens
 * @param {string} phoneNumber - Phone number
 * @returns {string} Formatted phone number
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return "";

  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Format based on length
  if (cleaned.length === 10) {
    // 0101234567 -> 010-123-4567
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  } else if (cleaned.length === 11) {
    // 01012345678 -> 010-1234-5678
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  }

  // Return original if it doesn't match expected patterns
  return phoneNumber;
};

/**
 * Format a business registration number with hyphens
 * @param {string} businessNumber - Business registration number
 * @returns {string} Formatted business number (123-45-67890)
 */
export const formatBusinessNumber = (businessNumber) => {
  if (!businessNumber) return "";
  return businessNumber.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");
};

/**
 * Format a number with thousand separators
 * @param {number|string} value - Number to format
 * @returns {string} Formatted number with thousand separators
 */
export const formatNumber = (value) => {
  if (value === undefined || value === null) return "";

  // If string, convert to number if it's numeric
  if (typeof value === "string") {
    if (!isNaN(value) && value.trim() !== "") {
      value = parseFloat(value);
    } else {
      return value; // Return as is if not numeric
    }
  }

  return value.toLocaleString();
};

/**
 * Parse a formatted number string back to a number
 * @param {string} value - Formatted number string
 * @returns {number} Numeric value
 */
export const parseNumber = (value) => {
  if (!value) return 0;
  return Number(value.replace(/[^\d.-]/g, ""));
};

/**
 * Format a monetary value with currency symbol
 * @param {number|string} value - Value to format
 * @param {string} currency - Currency code (default: KRW)
 * @returns {string} Formatted currency value
 */
export const formatCurrency = (value, currency = "KRW") => {
  if (value === undefined || value === null) return "";

  const numValue = typeof value === "string" ? parseNumber(value) : value;

  switch (currency) {
    case "KRW":
      return `₩${formatNumber(numValue)}`;
    case "USD":
      return `$${formatNumber(numValue)}`;
    default:
      return `${formatNumber(numValue)} ${currency}`;
  }
};

/**
 * Format a percentage value
 * @param {number|string} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === undefined || value === null) return "";

  const numValue = typeof value === "string" ? parseNumber(value) : value;
  return `${numValue.toFixed(decimals)}%`;
};

/**
 * Format a file size in bytes to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Truncate text to a specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, length = 50) => {
  if (!text) return "";

  return text.length > length ? `${text.substring(0, length)}...` : text;
};
