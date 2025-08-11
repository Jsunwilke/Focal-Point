// src/utils/secureLogger.js - Secure logging utility for development environments only

/**
 * Secure logger that only outputs logs in development environment
 * and sanitizes sensitive data to prevent accidental exposure
 */
class SecureLogger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname.includes('localhost'));
    
    // Disable debug logging even in development
    this.canLog = false;
  }

  /**
   * Sanitize data to remove sensitive information
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = [
      'email', 'password', 'token', 'key', 'secret', 'auth',
      'uid', 'organizationID', 'schoolId', 'photographerId',
      'sessionId', 'id', 'userId'
    ];

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => this.sanitizeData(item));
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Log with debug level - only in development
   */
  debug(message, data) {
    if (!this.canLog) return;
    
    if (data) {
      console.log(`[DEBUG] ${message}`, this.sanitizeData(data));
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }

  /**
   * Log with info level - only in development
   */
  info(message, data) {
    if (!this.canLog) return;
    
    if (data) {
      console.info(`[INFO] ${message}`, this.sanitizeData(data));
    } else {
      console.info(`[INFO] ${message}`);
    }
  }

  /**
   * Log with warning level - always allowed for important warnings
   */
  warn(message, data) {
    if (data) {
      console.warn(`[WARN] ${message}`, this.sanitizeData(data));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  }

  /**
   * Log with error level - always allowed for errors
   */
  error(message, error) {
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  /**
   * Performance timing - only in development
   */
  time(label) {
    if (!this.canLog) return;
    console.time(`[PERF] ${label}`);
  }

  /**
   * End performance timing - only in development
   */
  timeEnd(label) {
    if (!this.canLog) return;
    console.timeEnd(`[PERF] ${label}`);
  }

  /**
   * Check if logging is enabled
   */
  isEnabled() {
    return this.canLog;
  }
}

// Create singleton instance
const secureLogger = new SecureLogger();

export default secureLogger;

// Export individual methods for easier usage
export const {
  debug,
  info,
  warn,
  error,
  time,
  timeEnd,
  isEnabled
} = secureLogger;