/**
 * Sanitization utilities to prevent XSS attacks
 * Uses DOMPurify for input sanitization
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize plain text input to prevent XSS
 * Removes all HTML tags and only keeps text content
 * @param {string} input - The input to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeText = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // For plain text fields, strip all HTML tags
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
};

/**
 * Sanitize HTML input to prevent XSS while allowing safe formatting
 * Allows only safe HTML tags and attributes
 * @param {string} input - The HTML input to sanitize
 * @returns {string} Sanitized HTML
 */
export const sanitizeHTML = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const config = {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'u', 'br', 'p',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'a', 'code', 'pre', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    FORCE_BODY: false
  };

  return DOMPurify.sanitize(input, config);
};

/**
 * Sanitize URLs to prevent javascript: and data: URLs
 * @param {string} url - The URL to sanitize
 * @returns {string} Sanitized URL or empty string if invalid
 */
export const sanitizeURL = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const urlObj = new URL(url, window.location.origin);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }

    return urlObj.toString();
  } catch {
    // Invalid URL
    return '';
  }
};

/**
 * Escape user input for safe display in HTML
 * Converts special characters to HTML entities
 * @param {string} text - The text to escape
 * @returns {string} Escaped text safe for HTML display
 */
export const escapeHTML = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Validate and sanitize task title
 * @param {string} title - The task title
 * @returns {string} Sanitized title
 */
export const sanitizeTaskTitle = (title) => {
  if (!title || typeof title !== 'string') {
    return '';
  }

  // Remove any HTML tags from title
  const sanitized = sanitizeText(title);

  // Trim whitespace and limit length
  return sanitized.trim().substring(0, 255);
};

/**
 * Validate and sanitize task description
 * @param {string} description - The task description
 * @returns {string} Sanitized description
 */
export const sanitizeTaskDescription = (description) => {
  if (!description || typeof description !== 'string') {
    return '';
  }

  // Allow safe HTML formatting in descriptions
  const sanitized = sanitizeHTML(description);

  // Limit length to reasonable size
  return sanitized.substring(0, 5000);
};

/**
 * Validate and sanitize comment text
 * @param {string} text - The comment text
 * @returns {string} Sanitized comment text
 */
export const sanitizeCommentText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Allow some HTML formatting in comments
  const sanitized = sanitizeHTML(text);

  // Trim and limit length
  return sanitized.trim().substring(0, 3000);
};

export default {
  sanitizeText,
  sanitizeHTML,
  sanitizeURL,
  escapeHTML,
  sanitizeTaskTitle,
  sanitizeTaskDescription,
  sanitizeCommentText
};
