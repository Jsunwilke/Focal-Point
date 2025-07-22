/**
 * Input sanitization utilities for security
 */

/**
 * Sanitize a string to prevent XSS attacks
 * @param {string} input - The input string to sanitize
 * @returns {string} The sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .replace(/script/gi, '') // Remove script tags
    .substring(0, 1000); // Limit length
};

/**
 * Sanitize a number input
 * @param {string|number} input - The input to sanitize
 * @returns {string} The sanitized number string
 */
export const sanitizeNumber = (input) => {
  if (typeof input === 'number') {
    return input.toString();
  }
  
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[^\d.-]/g, '') // Only allow digits, dots, and hyphens
    .substring(0, 20); // Limit length
};

/**
 * Sanitize an email input
 * @param {string} input - The email input to sanitize
 * @returns {string} The sanitized email string
 */
export const sanitizeEmail = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 254); // RFC 5321 limit
};

/**
 * Sanitize a search term
 * @param {string} input - The search term to sanitize
 * @returns {string} The sanitized search term
 */
export const sanitizeSearchTerm = (input) => {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/script/gi, '') // Remove script tags
    .substring(0, 100); // Limit search term length
};

/**
 * Sanitize form data object
 * @param {Object} formData - The form data object to sanitize
 * @returns {Object} The sanitized form data object
 */
export const sanitizeFormData = (formData) => {
  if (!formData || typeof formData !== 'object') {
    return {};
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(formData)) {
    // Sanitize the key
    const sanitizedKey = sanitizeString(key);
    
    // Sanitize the value based on common field types
    if (key.includes('email') || key.includes('Email')) {
      sanitized[sanitizedKey] = sanitizeEmail(value);
    } else if (key.includes('number') || key.includes('Number')) {
      sanitized[sanitizedKey] = sanitizeNumber(value);
    } else {
      sanitized[sanitizedKey] = sanitizeString(value);
    }
  }
  
  return sanitized;
};

/**
 * Validate that a string contains only allowed characters for specific field types
 * @param {string} input - The input to validate
 * @param {string} type - The type of validation (alphanumeric, numeric, name, etc.)
 * @returns {boolean} True if valid, false otherwise
 */
export const validateInput = (input, type) => {
  if (typeof input !== 'string') {
    return false;
  }
  
  const patterns = {
    alphanumeric: /^[a-zA-Z0-9\s]*$/,
    numeric: /^[0-9]*$/,
    name: /^[a-zA-Z\s'-]*$/,
    cardNumber: /^[a-zA-Z0-9-]*$/,
    boxNumber: /^[a-zA-Z0-9-]*$/,
    school: /^[a-zA-Z0-9\s'-]*$/
  };
  
  return patterns[type] ? patterns[type].test(input) : true;
};

/**
 * Enhanced email validation
 * @param {string} email - Email to validate
 * @returns {object} Validation result with isValid and message
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, message: 'Email is required' };
  }
  
  const sanitizedEmail = sanitizeEmail(email);
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitizedEmail)) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }
  
  if (sanitizedEmail.length > 254) {
    return { isValid: false, message: 'Email address is too long' };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Enhanced password validation
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid, message, and strength
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required', strength: 0 };
  }
  
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };
  
  const passedChecks = Object.values(checks).filter(Boolean).length;
  
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters', strength: 0 };
  }
  
  if (password.length < 8) {
    return { isValid: true, message: 'Password is weak. Consider using 8+ characters', strength: 1 };
  }
  
  if (passedChecks < 3) {
    return { isValid: true, message: 'Password is weak. Include uppercase, lowercase, and numbers', strength: 1 };
  }
  
  if (passedChecks < 4) {
    return { isValid: true, message: 'Password is moderate', strength: 2 };
  }
  
  return { isValid: true, message: 'Password is strong', strength: 3 };
};

/**
 * Phone number validation
 * @param {string} phone - Phone number to validate
 * @returns {object} Validation result with isValid and message
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { isValid: true, message: '' }; // Phone is optional in most cases
  }
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // US phone number should be 10 digits (without country code) or 11 digits (with 1)
  if (digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly[0] === '1')) {
    return { isValid: true, message: '' };
  }
  
  return { isValid: false, message: 'Please enter a valid phone number' };
};

/**
 * Name validation (first name, last name, etc.)
 * @param {string} name - Name to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {object} Validation result with isValid and message
 */
export const validateName = (name, fieldName = 'Name') => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  const sanitizedName = sanitizeString(name);
  
  if (sanitizedName.length < 1) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  if (sanitizedName.length > 50) {
    return { isValid: false, message: `${fieldName} must be less than 50 characters` };
  }
  
  // Allow letters, spaces, hyphens, and apostrophes only
  if (!/^[a-zA-Z\s'-]+$/.test(sanitizedName)) {
    return { isValid: false, message: `${fieldName} contains invalid characters` };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Rate limiting helper - simple in-memory rate limiter
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  isAllowed(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
  
  getRemainingRequests(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    const validRequests = userRequests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Export a default rate limiter instance
export const defaultRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute