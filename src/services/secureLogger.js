// src/services/secureLogger.js

/**
 * Secure Logger Service
 *
 * Provides structured logging with configurable levels and sanitization
 * Prevents sensitive data from being logged in production
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class SecureLogger {
  constructor() {
    // Set log level based on environment
    // In production, only log warnings and errors
    this.logLevel = process.env.NODE_ENV === 'production'
      ? LOG_LEVELS.WARN
      : LOG_LEVELS.DEBUG;

    // Sensitive keys to redact from logs
    this.sensitiveKeys = [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'creditCard',
      'ssn'
    ];
  }

  /**
   * Sanitize data before logging to remove sensitive information
   */
  sanitize(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      // Check if key contains sensitive information
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveKeys.some(sensitiveKey =>
        lowerKey.includes(sensitiveKey.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const sanitizedContext = this.sanitize(context);

    return {
      timestamp,
      level,
      message,
      ...sanitizedContext
    };
  }

  /**
   * Debug level logging (development only)
   */
  debug(message, context = {}) {
    if (this.logLevel <= LOG_LEVELS.DEBUG) {
      const formatted = this.formatMessage('DEBUG', message, context);
      console.log('[DEBUG]', message, formatted);
    }
  }

  /**
   * Info level logging
   */
  info(message, context = {}) {
    if (this.logLevel <= LOG_LEVELS.INFO) {
      const formatted = this.formatMessage('INFO', message, context);
      console.log('[INFO]', message, formatted);
    }
  }

  /**
   * Warning level logging
   */
  warn(message, context = {}) {
    if (this.logLevel <= LOG_LEVELS.WARN) {
      const formatted = this.formatMessage('WARN', message, context);
      console.warn('[WARN]', message, formatted);
    }
  }

  /**
   * Error level logging
   */
  error(message, context = {}) {
    if (this.logLevel <= LOG_LEVELS.ERROR) {
      const formatted = this.formatMessage('ERROR', message, context);
      console.error('[ERROR]', message, formatted);
    }
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.logLevel = LOG_LEVELS[level];
    }
  }
}

// Create singleton instance
export const secureLogger = new SecureLogger();

// Export LOG_LEVELS for external configuration
export { LOG_LEVELS };

export default secureLogger;
