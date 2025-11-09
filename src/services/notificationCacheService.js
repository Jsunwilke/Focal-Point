// src/services/notificationCacheService.js
class NotificationCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_notifications_';
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  getCacheKey(userId, organizationID) {
    return `${this.CACHE_PREFIX}${userId}_${organizationID}_v${this.CACHE_VERSION}`;
  }

  getCachedNotifications(userId, organizationID) {
    try {
      const key = this.getCacheKey(userId, organizationID);
      const cached = localStorage.getItem(key);

      if (!cached) return null;

      const data = JSON.parse(cached);

      if (Date.now() - data.timestamp > this.MAX_CACHE_AGE) {
        this.clearCache(userId, organizationID);
        return null;
      }

      return data.notifications;
    } catch (error) {
      console.error('Error getting cached notifications:', error);
      return null;
    }
  }

  setCachedNotifications(userId, organizationID, notifications) {
    try {
      const key = this.getCacheKey(userId, organizationID);
      const data = {
        notifications,
        timestamp: Date.now(),
        version: this.CACHE_VERSION
      };

      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching notifications:', error);
    }
  }

  clearCache(userId, organizationID) {
    try {
      const key = this.getCacheKey(userId, organizationID);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing notification cache:', error);
    }
  }

  getLatestTimestamp(userId, organizationID) {
    try {
      const notifications = this.getCachedNotifications(userId, organizationID);
      if (!notifications || notifications.length === 0) return null;

      const timestamps = notifications
        .map(n => {
          if (n.createdAt?.toDate) return n.createdAt.toDate().getTime();
          if (n.createdAt) return new Date(n.createdAt).getTime();
          return 0;
        })
        .filter(t => t > 0);

      return timestamps.length > 0 ? Math.max(...timestamps) : null;
    } catch (error) {
      console.error('Error getting latest timestamp:', error);
      return null;
    }
  }

  appendNewNotifications(userId, organizationID, newNotifications) {
    try {
      const cached = this.getCachedNotifications(userId, organizationID) || [];
      const combined = [...newNotifications, ...cached];

      const unique = combined.filter((notification, index, self) =>
        index === self.findIndex(n => n.id === notification.id)
      );

      this.setCachedNotifications(userId, organizationID, unique);
      return unique;
    } catch (error) {
      console.error('Error appending notifications:', error);
      return newNotifications;
    }
  }
}

const notificationCacheService = new NotificationCacheService();
export default notificationCacheService;
