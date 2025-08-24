class StreamChatCacheService {
  constructor() {
    this.CACHE_PREFIX = 'focal_stream_chat_';
    this.CHANNELS_KEY = `${this.CACHE_PREFIX}channels`;
    this.USERS_KEY = `${this.CACHE_PREFIX}users`;
    this.CACHE_VERSION = '1.0';
    this.MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    this.MAX_MESSAGES_PER_CHANNEL = 500; // Limit cache size
    this.MAX_CHANNELS_CACHE = 50; // Limit number of cached channels
  }

  // Channels cache management
  setCachedChannels(channels) {
    try {
      // Limit cache size by keeping only recent channels
      const limitedChannels = channels.slice(0, this.MAX_CHANNELS_CACHE);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: limitedChannels.map(channel => this.serializeChannel(channel))
      };
      localStorage.setItem(this.CHANNELS_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache Stream channels:', error);
    }
  }

  getCachedChannels() {
    try {
      const cached = localStorage.getItem(this.CHANNELS_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearChannelsCache();
        return null;
      }

      // Deserialize channels
      const channels = cacheData.data.map(channel => this.deserializeChannel(channel));
      return channels;
    } catch (error) {
      console.warn('Failed to retrieve cached Stream channels:', error);
      return null;
    }
  }

  clearChannelsCache() {
    try {
      localStorage.removeItem(this.CHANNELS_KEY);
    } catch (error) {
      console.warn('Failed to clear Stream channels cache:', error);
    }
  }

  // Users cache management
  setCachedUsers(users) {
    try {
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        data: users
      };
      localStorage.setItem(this.USERS_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache Stream users:', error);
    }
  }

  getCachedUsers() {
    try {
      const cached = localStorage.getItem(this.USERS_KEY);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearUsersCache();
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.warn('Failed to retrieve cached Stream users:', error);
      return null;
    }
  }

  clearUsersCache() {
    try {
      localStorage.removeItem(this.USERS_KEY);
    } catch (error) {
      console.warn('Failed to clear Stream users cache:', error);
    }
  }

  // Channel messages cache management
  getChannelMessagesKey(channelId) {
    return `${this.CACHE_PREFIX}messages_${channelId}`;
  }

  setCachedChannelMessages(channelId, messages) {
    try {
      // Limit cache size by keeping only recent messages
      const limitedMessages = messages.slice(-this.MAX_MESSAGES_PER_CHANNEL);
      
      const cacheData = {
        version: this.CACHE_VERSION,
        timestamp: Date.now(),
        channelId,
        data: limitedMessages.map(msg => this.serializeMessage(msg))
      };
      
      const key = this.getChannelMessagesKey(channelId);
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache messages for Stream channel ${channelId}:`, error);
    }
  }

  getCachedChannelMessages(channelId) {
    try {
      const key = this.getChannelMessagesKey(channelId);
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // Check cache version and age
      if (cacheData.version !== this.CACHE_VERSION || 
          Date.now() - cacheData.timestamp > this.MAX_CACHE_AGE) {
        this.clearChannelMessagesCache(channelId);
        return null;
      }

      // Deserialize messages
      const messages = cacheData.data.map(msg => this.deserializeMessage(msg));
      return messages;
    } catch (error) {
      console.warn(`Failed to retrieve cached messages for Stream channel ${channelId}:`, error);
      return null;
    }
  }

  getLatestCachedMessageTimestamp(channelId) {
    try {
      const messages = this.getCachedChannelMessages(channelId);
      if (!messages || messages.length === 0) return null;

      // Find the latest timestamp
      const latestMessage = messages.reduce((latest, current) => {
        const currentTime = new Date(current.created_at || current.createdAt).getTime();
        const latestTime = new Date(latest.created_at || latest.createdAt).getTime();
        return currentTime > latestTime ? current : latest;
      });

      return new Date(latestMessage.created_at || latestMessage.createdAt);
    } catch (error) {
      console.warn(`Failed to get latest cached message timestamp for Stream channel ${channelId}:`, error);
      return null;
    }
  }

  appendNewChannelMessages(channelId, newMessages) {
    try {
      const cachedMessages = this.getCachedChannelMessages(channelId) || [];
      const existingIds = new Set(cachedMessages.map(msg => msg.id));
      
      // Filter out duplicates and add new messages
      const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
      const updatedMessages = [...cachedMessages, ...uniqueNewMessages];
      
      // Sort by timestamp to maintain order
      updatedMessages.sort((a, b) => {
        const aTime = new Date(a.created_at || a.createdAt).getTime();
        const bTime = new Date(b.created_at || b.createdAt).getTime();
        return aTime - bTime;
      });

      this.setCachedChannelMessages(channelId, updatedMessages);
      return updatedMessages;
    } catch (error) {
      console.warn(`Failed to append new messages for Stream channel ${channelId}:`, error);
      return newMessages;
    }
  }

  clearChannelMessagesCache(channelId) {
    try {
      const key = this.getChannelMessagesKey(channelId);
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to clear messages cache for Stream channel ${channelId}:`, error);
    }
  }

  // Serialization/deserialization for Stream Chat objects
  serializeChannel(channel) {
    try {
      return {
        id: channel.id,
        cid: channel.cid,
        type: channel.type,
        data: channel.data,
        state: {
          members: channel.state?.members || {},
          membership: channel.state?.membership || {},
          messages: [], // Don't cache messages in channel state
          typing: {},
          read: channel.state?.read || {},
          watchers: {},
          watcherCount: channel.state?.watcherCount || 0,
          unreadCount: channel.state?.unreadCount || 0
        },
        lastMessage: channel.lastMessage ? this.serializeMessage(channel.lastMessage) : null,
        lastMessageAt: channel.lastMessageAt ? channel.lastMessageAt.toISOString() : null,
        createdAt: channel.createdAt ? channel.createdAt.toISOString() : null,
        updatedAt: channel.updatedAt ? channel.updatedAt.toISOString() : null
      };
    } catch (error) {
      console.warn('Failed to serialize Stream channel:', error);
      return channel;
    }
  }

  deserializeChannel(channelData) {
    try {
      return {
        ...channelData,
        lastMessageAt: channelData.lastMessageAt ? new Date(channelData.lastMessageAt) : null,
        createdAt: channelData.createdAt ? new Date(channelData.createdAt) : null,
        updatedAt: channelData.updatedAt ? new Date(channelData.updatedAt) : null,
        lastMessage: channelData.lastMessage ? this.deserializeMessage(channelData.lastMessage) : null
      };
    } catch (error) {
      console.warn('Failed to deserialize Stream channel:', error);
      return channelData;
    }
  }

  serializeMessage(message) {
    try {
      return {
        id: message.id,
        text: message.text,
        html: message.html,
        type: message.type,
        user: message.user,
        attachments: message.attachments || [],
        mentioned_users: message.mentioned_users || [],
        silent: message.silent,
        shadowed: message.shadowed,
        reply_count: message.reply_count || 0,
        created_at: message.created_at ? message.created_at.toISOString() : null,
        updated_at: message.updated_at ? message.updated_at.toISOString() : null,
        deleted_at: message.deleted_at ? message.deleted_at.toISOString() : null,
        parent_id: message.parent_id,
        thread_participants: message.thread_participants || [],
        reaction_counts: message.reaction_counts || {},
        latest_reactions: message.latest_reactions || [],
        own_reactions: message.own_reactions || [],
        cid: message.cid,
        command: message.command,
        args: message.args
      };
    } catch (error) {
      console.warn('Failed to serialize Stream message:', error);
      return message;
    }
  }

  deserializeMessage(messageData) {
    try {
      return {
        ...messageData,
        created_at: messageData.created_at ? new Date(messageData.created_at) : null,
        updated_at: messageData.updated_at ? new Date(messageData.updated_at) : null,
        deleted_at: messageData.deleted_at ? new Date(messageData.deleted_at) : null
      };
    } catch (error) {
      console.warn('Failed to deserialize Stream message:', error);
      return messageData;
    }
  }

  // Cache statistics and management
  getCacheStats() {
    try {
      const stats = {
        channelsCached: !!this.getCachedChannels(),
        usersCached: !!this.getCachedUsers(),
        channelMessagesCached: 0,
        totalCacheSize: 0,
        cacheKeys: []
      };

      // Count cached items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          stats.cacheKeys.push(key);
          
          if (key.includes('messages_')) {
            stats.channelMessagesCached++;
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
      console.warn('Failed to get Stream cache stats:', error);
      return {
        channelsCached: false,
        usersCached: false,
        channelMessagesCached: 0,
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
      console.log(`Cleared ${keysToRemove.length} Stream chat cache items`);
    } catch (error) {
      console.warn('Failed to clear all Stream cache:', error);
    }
  }

  // Check if we have cached data for faster initial load
  hasCachedData(channelId) {
    if (channelId) {
      return !!this.getCachedChannelMessages(channelId);
    }
    return !!this.getCachedChannels();
  }

  // Update single channel in cache
  updateCachedChannel(updatedChannel) {
    try {
      const cachedChannels = this.getCachedChannels();
      if (!cachedChannels) return;

      const index = cachedChannels.findIndex(channel => channel.id === updatedChannel.id);
      if (index !== -1) {
        cachedChannels[index] = this.serializeChannel(updatedChannel);
        this.setCachedChannels(cachedChannels);
      }
    } catch (error) {
      console.warn('Failed to update cached Stream channel:', error);
    }
  }

  // Search functionality for cached data
  searchCachedChannels(searchTerm) {
    try {
      const channels = this.getCachedChannels();
      if (!channels || !searchTerm) return channels || [];

      const lowercaseSearch = searchTerm.toLowerCase();
      return channels.filter(channel => {
        const channelName = channel.data?.name?.toLowerCase() || '';
        const memberNames = Object.values(channel.state?.members || {})
          .map(member => member.user?.name?.toLowerCase() || '')
          .join(' ');
        
        return channelName.includes(lowercaseSearch) || 
               memberNames.includes(lowercaseSearch);
      });
    } catch (error) {
      console.warn('Failed to search cached Stream channels:', error);
      return [];
    }
  }

  searchCachedUsers(searchTerm) {
    try {
      const users = this.getCachedUsers();
      if (!users || !searchTerm) return users || [];

      const lowercaseSearch = searchTerm.toLowerCase();
      return users.filter(user => {
        const userName = user.name?.toLowerCase() || '';
        const userEmail = user.email?.toLowerCase() || '';
        
        return userName.includes(lowercaseSearch) || 
               userEmail.includes(lowercaseSearch);
      });
    } catch (error) {
      console.warn('Failed to search cached Stream users:', error);
      return [];
    }
  }

  // Channel-specific helpers
  getChannelFromCache(channelId) {
    try {
      const channels = this.getCachedChannels();
      if (!channels) return null;

      return channels.find(channel => channel.id === channelId || channel.cid === channelId);
    } catch (error) {
      console.warn(`Failed to get cached Stream channel ${channelId}:`, error);
      return null;
    }
  }

  // Message pagination helpers
  getCachedMessagePage(channelId, pageSize = 20, beforeDate = null) {
    try {
      const allMessages = this.getCachedChannelMessages(channelId);
      if (!allMessages || allMessages.length === 0) return { messages: [], hasMore: false };

      let messages = allMessages;
      
      // Filter to messages before the specified date if provided
      if (beforeDate) {
        const beforeTime = beforeDate.getTime();
        messages = allMessages.filter(msg => {
          const msgTime = new Date(msg.created_at || msg.createdAt).getTime();
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
      console.warn(`Failed to get cached message page for Stream channel ${channelId}:`, error);
      return { messages: [], hasMore: false };
    }
  }
}

// Create singleton instance
export const streamChatCacheService = new StreamChatCacheService();
export default streamChatCacheService;