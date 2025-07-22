/**
 * Secure API client for external service calls
 * Implements rate limiting, request sanitization, and error handling
 */

import { defaultRateLimiter } from './inputSanitizer';
import secureLogger from './secureLogger';

/**
 * Secure fetch wrapper with rate limiting and error handling
 */
class SecureApiClient {
  constructor() {
    this.baseTimeout = 10000; // 10 seconds default timeout
    this.allowedHosts = [
      'nominatim.openstreetmap.org',
      'api.open-meteo.com',
      'tile.openstreetmap.org'
    ];
  }

  /**
   * Validate that the URL is from an allowed host
   */
  isAllowedUrl(url) {
    try {
      const urlObj = new URL(url);
      return this.allowedHosts.includes(urlObj.hostname);
    } catch (error) {
      secureLogger.error('Invalid URL provided to secure API client', error);
      return false;
    }
  }

  /**
   * Sanitize query parameters to prevent injection
   */
  sanitizeParams(params) {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/[<>'"]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/data:/gi, '')
          .substring(0, 500); // Limit parameter length
      } else if (typeof value === 'number') {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Secure fetch with rate limiting and validation
   */
  async secureRun(url, options = {}) {
    // Validate URL
    if (!this.isAllowedUrl(url)) {
      throw new Error('URL not allowed by security policy');
    }

    // Rate limiting based on hostname
    const hostname = new URL(url).hostname;
    if (!defaultRateLimiter.isAllowed(hostname)) {
      throw new Error('Rate limit exceeded for this service');
    }

    // Set secure defaults
    const secureOptions = {
      method: 'GET',
      timeout: this.baseTimeout,
      headers: {
        'User-Agent': 'FocalPoint-Studio-App/1.0',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      ...options
    };

    // Remove credentials and potentially dangerous options
    delete secureOptions.credentials;
    delete secureOptions.mode;

    try {
      secureLogger.debug('Making secure API request', { 
        hostname,
        hasParams: Object.keys(secureOptions).length > 0
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), secureOptions.timeout);

      const response = await fetch(url, {
        ...secureOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Limit response size to prevent DoS
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 1024 * 1024) { // 1MB limit
        throw new Error('Response too large');
      }

      return response;
    } catch (error) {
      secureLogger.error('Secure API request failed', error);
      throw error;
    }
  }

  /**
   * Secure geocoding with OpenStreetMap Nominatim
   */
  async geocodeAddress(address) {
    if (!address || typeof address !== 'string') {
      return null;
    }

    // Sanitize the address
    const sanitizedAddress = address
      .trim()
      .replace(/[<>'"]/g, '')
      .substring(0, 200); // Limit address length

    if (!sanitizedAddress) {
      return null;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedAddress)}&limit=1&addressdetails=0`;
      
      const response = await this.secureRun(url, {
        headers: {
          'User-Agent': 'FocalPoint-Studio-App/1.0 (Contact: support@focal-point.app)',
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0];
        
        // Validate coordinates are reasonable (roughly within world bounds)
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          secureLogger.warn('Invalid coordinates returned from geocoding service');
          return null;
        }
        
        return {
          latitude: lat,
          longitude: lon
        };
      }
      
      return null;
    } catch (error) {
      secureLogger.error('Geocoding request failed', error);
      return null;
    }
  }

  /**
   * Secure weather API call
   */
  async getWeatherConditions(latitude, longitude) {
    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('Invalid coordinates provided');
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`;
      
      const response = await this.secureRun(url, {
        timeout: 8000 // Shorter timeout for weather
      });

      const data = await response.json();
      
      if (data && data.current_weather) {
        const temp = Math.round(data.current_weather.temperature);
        const weatherCode = data.current_weather.weathercode;
        
        // Basic weather condition mapping with validation
        const conditions = {
          0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
          45: "Foggy", 48: "Foggy", 51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
          61: "Light Rain", 63: "Rain", 65: "Heavy Rain", 71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
          80: "Rain Showers", 81: "Heavy Showers", 95: "Thunderstorm", 96: "Thunderstorm with Hail"
        };
        
        const condition = conditions[weatherCode] || "Unknown";
        
        // Validate temperature is reasonable (-100 to 150°F)
        if (temp < -100 || temp > 150) {
          secureLogger.warn('Unreasonable temperature returned from weather service');
          return 'Weather data invalid';
        }
        
        return `${condition}, ${temp}°F`;
      }
      
      return 'Weather unavailable';
    } catch (error) {
      secureLogger.error('Weather request failed', error);
      return 'Weather unavailable';
    }
  }
}

// Create singleton instance
const secureApiClient = new SecureApiClient();

export default secureApiClient;

// Export specific methods for easier usage
export const { geocodeAddress, getWeatherConditions } = secureApiClient;