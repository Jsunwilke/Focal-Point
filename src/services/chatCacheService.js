import { Timestamp } from 'firebase/firestore';

class ChatCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_chat_';
    this.CONVERSATIONS_KEY = `${this.CACHE_PREFIX}conversations`;
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.MAX_MESSAGES_PER_CONVERSATION = 500; // Limit cache size
  }

  // Conversations cache management
  setCachedConversations(conversations) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: conversations
      };
      localStorage.setItem(this.CONVERSATIONS_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache conversations:', error);
    }
  }

  getCachedConversations() {
    try {
      const cached = localStorage.getItem(this.CONVERSATIONS_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearConversationsCache();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached conversations:', error);
      return null;
    }
  }

  clearConversationsCache() {
    try {
      localStorage.removeItem(this.CONVERSATIONS_KEY);
    } catch (error) {
      console.warn('Failed to clear conversations cache:', error);
    }
  }

  // Messages cache management
  getMessagesKey(conversationId) {
    return `${this.CACHE_PREFIX}messages_${conversationId}`;
  }

  setCachedMessages(conversationId, messages) {
    try {
      // Limit cache size by keeping only recent messages
      const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_CONVERSATION);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        conversationId,
        data: limitedMessages.map(msg => this.serializeMessage(msg))
      };
      
      const key = this.getMessagesKey(conversationId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache messages for conversation ${conversationId}:`, error);
    }
  }

  getCachedMessages(conversationId) {
    try {
      const key = this.getMessagesKey(conversationId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearMessagesCache(conversationId);
        return null;
      }

      // Deserialize messages (restore Timestamp objects)
      const messages = cacheData.data.map(msg => this.deserializeMessage(msg));
      return messages;
    } catch (error) {
      console.warn(`Failed to retrieve cached messages for conversation ${conversationId}:`, error);
      return null;
    }
  }

  getLatestCachedMessageTimestamp(conversationId) {
    try {
      const messages = this.getCachedMessages(conversationId);
      if (!messages || messages.length === 0) return null;

      // Find the latest timestamp
      const latestMessage = messages.reduce((latest, current) => {
        const currentTime = current.timestamp?.toMillis?.() || 0;
        const latestTime = latest.timestamp?.toMillis?.() || 0;
        return currentTime > latestTime ? current : latest;
      });

      return latestMessage.timestamp;
    } catch (error) {
      console.warn(`Failed to get latest cached message timestamp for conversation ${conversationId}:`, error);
      return null;
    }
  }

  appendNewMessages(conversationId, newMessages) {
    try {
      const cachedMessages = this.getCachedMessages(conversationId) || [];
      const existingIds = new Set(cachedMessages.map(msg => msg.id));
      
      // Filter out duplicates and add new messages
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      const updatedMessages = [...cachedMessages, ...uniqueNewMessages];
      
      // Sort by timestamp to maintain order
      updatedMessages.sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return aTime - bTime;
      });

      this.setCachedMessages(conversationId, updatedMessages);
      return updatedMessages;
    } catch (error) {
      console.warn(`Failed to append new messages for conversation ${conversationId}:`, error);
      return newMessages;
    }
  }

  clearMessagesCache(conversationId) {
    try {
      const key = this.getMessagesKey(conversationId);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear messages cache for conversation ${conversationId}:`, error);
    }
  }

  // Utility methods for serialization/deserialization
  serializeMessage(message) {
    try {
      return {
        ...message,
        timestamp: message.timestamp ? {
          _isTimestamp: true,
          seconds: message.timestamp.seconds,
          nanoseconds: message.timestamp.nanoseconds
        } : null,
        createdAt: message.createdAt ? {
          _isTimestamp: true,
          seconds: message.createdAt.seconds,
          nanoseconds: message.createdAt.nanoseconds
        } : null
      };
    } catch (error) {
      console.warn('Failed to serialize message:', error);
      return message;
    }
  }

  deserializeMessage(message) {
    try {
      return {
        ...message,
        timestamp: message.timestamp?._isTimestamp ? 
          new Timestamp(message.timestamp.seconds, message.timestamp.nanoseconds) : 
          message.timestamp,
        createdAt: message.createdAt?._isTimestamp ? 
          new Timestamp(message.createdAt.seconds, message.createdAt.nanoseconds) : 
          message.createdAt
      };
    } catch (error) {
      console.warn('Failed to deserialize message:', error);
      return message;
    }
  }

  // Cache statistics and management
  getCacheStats() {
    try {
      const stats = {
        conversationsCached: !!this.getCachedConversations(),
        messagesCached: 0,
        totalCacheSize: 0,
        cacheKeys: []
      };

      // Count cached conversations
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          stats.cacheKeys.push(key);
          
          if (key.includes('messages_')) {
            stats.messagesCached++;
          }
          
          try {
            const value = localStorage.getItem(key);
            stats.totalCacheSize += value ? value.length : 0;
          } catch (error) {
            // Skip if we can't read the item
          }
        }
      }

      return stats;
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        conversationsCached: false,
        messagesCached: 0,
        totalCacheSize: 0,
        cacheKeys: []
      };
    }
  }

  clearAllCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} chat cache items`);
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
    }
  }

  // Check if we have cached data for faster initial load
  hasCachedData(conversationId) {
    if (conversationId) {
      return !!this.getCachedMessages(conversationId);
    }
    return !!this.getCachedConversations();
  }

  // Update single conversation in cache
  updateCachedConversation(updatedConversation) {
    try {
      const cachedConversations = this.getCachedConversations();
      if (!cachedConversations) return;

      const index = cachedConversations.findIndex(conv => conv.id === updatedConversation.id);
      if (index !== -1) {
        cachedConversations[index] = updatedConversation;
        this.setCachedConversations(cachedConversations);
      }
    } catch (error) {
      console.warn('Failed to update cached conversation:', error);
    }
  }

  // Pagination-specific cache methods
  prependOlderMessages(conversationId, olderMessages) {
    try {
      const cachedMessages = this.getCachedMessages(conversationId) || [];
      const existingIds = new Set(cachedMessages.map(msg => msg.id));
      
      // Filter out duplicates and add older messages to the beginning
      const uniqueOlderMessages = olderMessages.filter(msg => !existingIds.has(msg.id));
      const updatedMessages = [...uniqueOlderMessages, ...cachedMessages];
      
      // Sort by timestamp to maintain order
      updatedMessages.sort((a, b) => {
        const aTime = a.timestamp?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || 0;
        return aTime - bTime;
      });

      // Limit total cache size
      const limitedMessages = updatedMessages.slice(-this.MAX_MESSAGES_PER_CONVERSATION);
      this.setCachedMessages(conversationId, limitedMessages);
      
      return limitedMessages;
    } catch (error) {
      console.warn(`Failed to prepend older messages for conversation ${conversationId}:`, error);
      return olderMessages;
    }
  }

  getOldestCachedMessageTimestamp(conversationId) {
    try {
      const messages = this.getCachedMessages(conversationId);
      if (!messages || messages.length === 0) return null;

      // Find the oldest timestamp
      const oldestMessage = messages.reduce((oldest, current) => {
        const currentTime = current.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER;
        const oldestTime = oldest.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER;
        return currentTime < oldestTime ? current : oldest;
      });

      return oldestMessage.timestamp;
    } catch (error) {
      console.warn(`Failed to get oldest cached message timestamp for conversation ${conversationId}:`, error);
      return null;
    }
  }

  // Check if we have enough cached messages to satisfy a page request
  hasEnoughCachedMessages(conversationId, requestedCount = 20) {
    try {
      const messages = this.getCachedMessages(conversationId);
      return messages && messages.length >= requestedCount;
    } catch (error) {
      console.warn(`Failed to check cached message count for conversation ${conversationId}:`, error);
      return false;
    }
  }

  // Get a page of messages from cache
  getCachedMessagePage(conversationId, pageSize = 20, beforeTimestamp = null) {
    try {
      const allMessages = this.getCachedMessages(conversationId);
      if (!allMessages || allMessages.length === 0) return { messages: [], hasMore: false };

      let messages = allMessages;
      
      // Filter to messages before the specified timestamp if provided
      if (beforeTimestamp) {
        const beforeTime = beforeTimestamp.toMillis?.() || beforeTimestamp;
        messages = allMessages.filter(msg => {
          const msgTime = msg.timestamp?.toMillis?.() || 0;
          return msgTime < beforeTime;
        });
      }

      // Get the requested page size from the end (most recent)
      const startIndex = Math.max(0, messages.length - pageSize);
      const pageMessages = messages.slice(startIndex);
      const hasMore = startIndex > 0;

      return {
        messages: pageMessages,
        hasMore,
        oldestMessage: pageMessages.length > 0 ? pageMessages[0] : null
      };
    } catch (error) {
      console.warn(`Failed to get cached message page for conversation ${conversationId}:`, error);
      return { messages: [], hasMore: false };
    }
  }
}

// Create singleton instance
export const chatCacheService = new ChatCacheService();
export default chatCacheService;