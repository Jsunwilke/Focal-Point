import { StreamChat } from 'stream-chat';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { readCounter } from './readCounter';
import streamChatCacheService from './streamChatCacheService';

class StreamChatService {
  constructor() {
    this.client = null;
    this.currentUser = null;
  }

  // Initialize Stream Chat client
  initializeClient() {
    if (!this.client) {
      const apiKey = process.env.REACT_APP_STREAM_KEY;
      if (!apiKey || apiKey === 'your_stream_api_key_here') {
        throw new Error('Stream Chat API key is missing or not configured. Please set REACT_APP_STREAM_KEY in your environment variables.');
      }
      this.client = StreamChat.getInstance(apiKey);
    }
    return this.client;
  }

  // Generate token for development (WARNING: Only for development!)
  // In production, this should be done on your backend
  generateDevToken(userId) {
    // Check if we're in production environment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECURITY WARNING: Client-side token generation is disabled in production. Please implement server-side token generation.');
    }

    const apiSecret = process.env.REACT_APP_STREAM_SECRET;
    if (!apiSecret || apiSecret === 'your_stream_secret_here_dev_only') {
      throw new Error('Stream Chat API secret is missing or not configured. Please set REACT_APP_STREAM_SECRET in your environment variables.');
    }
    
    // Initialize client if not already done
    if (!this.client) {
      this.initializeClient();
    }
    
    console.warn('⚠️ WARNING: Using client-side token generation. This is only safe for development!');
    
    // For development only - in production, tokens should be generated server-side
    return this.client.devToken(userId);
  }

  // Secure token generation using Firebase Cloud Function
  async generateSecureToken(userId) {
    try {
      // Get Firebase Functions instance
      const functions = getFunctions();
      const generateToken = httpsCallable(functions, 'generateStreamChatToken');
      
      console.log('Calling Firebase Function to generate secure Stream Chat token for user:', userId);
      
      // Call the Cloud Function
      const result = await generateToken({ userId });
      
      console.log('Firebase Function response:', result);
      
      if (!result.data || !result.data.success) {
        console.error('Firebase Function returned failure:', result.data);
        throw new Error(result.data?.error || 'Token generation failed');
      }
      
      if (!result.data.token) {
        console.error('Firebase Function did not return a token:', result.data);
        throw new Error('No token returned from Firebase Function');
      }
      
      console.log('Secure Stream Chat token generated successfully');
      return result.data.token;
    } catch (error) {
      console.error('Error generating secure token via Cloud Function:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      // Provide more specific error messages
      if (error.code === 'functions/unauthenticated') {
        throw new Error('User must be authenticated to generate Stream Chat token');
      } else if (error.code === 'functions/not-found') {
        throw new Error('Stream Chat token generation function not deployed. Please run: firebase deploy --only functions:generateStreamChatToken');
      } else if (error.code === 'functions/permission-denied') {
        throw new Error('Permission denied: Cannot generate token for this user');
      } else if (error.code === 'functions/internal') {
        throw new Error('Internal server error in token generation function. Check Firebase Functions logs.');
      }
      
      throw error;
    }
  }

  // Get Firebase ID token for authentication with backend
  async getFirebaseToken() {
    try {
      // This would get the current Firebase user's ID token
      // You'll need to implement this based on your auth setup
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        return await user.getIdToken();
      }
      throw new Error('No authenticated user');
    } catch (error) {
      console.error('Error getting Firebase token:', error);
      throw error;
    }
  }

  // Connect user to Stream Chat
  async connectUser(firebaseUser) {
    try {
      // Validate input
      if (!firebaseUser || !firebaseUser.uid) {
        throw new Error('Invalid user data provided to Stream Chat connection');
      }

      this.initializeClient();

      // Prepare user data for Stream with validation
      const streamUser = {
        id: firebaseUser.uid,
        name: this.sanitizeUserName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User'),
        email: firebaseUser.email,
        image: firebaseUser.photoURL || this.generateAvatarUrl(firebaseUser.displayName || 'U'),
        role: firebaseUser.role || 'user',
        organizationID: firebaseUser.organizationID
      };

      // Validate required fields
      if (!streamUser.name || !streamUser.email) {
        throw new Error('Missing required user information for Stream Chat connection');
      }

      // Generate secure server-side token (PRODUCTION ONLY)
      let token;
      try {
        console.log('🔐 Generating secure Stream Chat token via Firebase Function...');
        token = await this.generateSecureToken(firebaseUser.uid);
        console.log('✅ Secure token generated successfully');
      } catch (error) {
        console.error('❌ Server-side token generation failed:', error.message);
        console.error('❌ Token generation error details:', error);
        
        // No fallback - secure tokens are required for production API keys
        throw new Error(`Stream Chat authentication failed: ${error.message}. Please ensure the Firebase Function 'generateStreamChatToken' is properly deployed and configured.`);
      }

      // Connect to Stream with timeout
      const connectPromise = this.client.connectUser(streamUser, token);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stream Chat connection timeout')), 15000)
      );

      const response = await Promise.race([connectPromise, timeoutPromise]);
      this.currentUser = response.me;

      // Update user cache
      this.updateUserInCache(streamUser);

      console.log('Stream Chat user connected:', this.currentUser.id);
      return this.currentUser;
    } catch (error) {
      console.error('Error connecting to Stream Chat:', error);
      
      // Provide more specific error messages
      if (error.message.includes('API key')) {
        throw new Error('Stream Chat API key is invalid or missing. Please check your configuration.');
      } else if (error.message.includes('token')) {
        throw new Error('Stream Chat token generation failed. Please check your authentication setup.');
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        throw new Error('Network connection to Stream Chat failed. Please check your internet connection.');
      }
      
      throw error;
    }
  }

  // Helper methods for user data validation and processing
  sanitizeUserName(name) {
    if (!name) return 'User';
    // Remove any potentially dangerous characters and limit length
    return name.replace(/[<>\"'&]/g, '').trim().substring(0, 50);
  }

  generateAvatarUrl(name) {
    const initial = encodeURIComponent(name.charAt(0).toUpperCase());
    return `https://ui-avatars.com/api/?name=${initial}&background=6366f1&color=fff&size=128`;
  }

  updateUserInCache(streamUser) {
    try {
      const cachedUsers = streamChatCacheService.getCachedUsers() || [];
      const existingIndex = cachedUsers.findIndex(u => u.id === streamUser.id);
      
      if (existingIndex >= 0) {
        cachedUsers[existingIndex] = streamUser;
      } else {
        cachedUsers.push(streamUser);
      }
      
      streamChatCacheService.setCachedUsers(cachedUsers);
    } catch (error) {
      console.warn('Failed to update user in cache:', error);
    }
  }

  // Disconnect user from Stream Chat
  async disconnectUser() {
    if (this.client && this.currentUser) {
      await this.client.disconnectUser();
      this.currentUser = null;
      console.log('Stream Chat user disconnected');
    }
  }

  // Get or create a direct message channel
  async getOrCreateDirectMessageChannel(otherUserId, otherUserData = {}) {
    if (!this.client || !this.currentUser) {
      throw new Error('User not connected to Stream Chat');
    }

    try {
      // Create a unique channel ID for the two users
      const members = [this.currentUser.id, otherUserId].sort();
      const channelId = `dm-${members.join('-')}`;

      // Get or create the channel with proper created_by_id for server-side auth
      const channel = this.client.channel('messaging', channelId, {
        members: members,
        name: `${this.currentUser.name} & ${otherUserData.name || 'User'}`,
        created_by_id: this.currentUser.id // Required for server-side auth
      });

      await channel.create();
      return channel;
    } catch (error) {
      console.error('Error creating direct message channel:', error);
      throw error;
    }
  }

  // Get or create a group channel
  async getOrCreateGroupChannel(channelId, channelData) {
    if (!this.client || !this.currentUser) {
      throw new Error('User not connected to Stream Chat');
    }

    try {
      const channel = this.client.channel('team', channelId, {
        ...channelData,
        created_by_id: this.currentUser.id // Required for server-side auth
      });

      await channel.create();
      return channel;
    } catch (error) {
      console.error('Error creating group channel:', error);
      throw error;
    }
  }

  // Get all channels for the current user with caching
  async getUserChannels() {
    if (!this.client || !this.currentUser) {
      throw new Error('User not connected to Stream Chat');
    }

    try {
      // Check cache first
      const cachedChannels = streamChatCacheService.getCachedChannels();
      if (cachedChannels) {
        readCounter.recordCacheHit('stream_channels', 'StreamChat', cachedChannels.length);
        console.log('Loaded channels from cache');
        
        // Return cached data immediately, then update in background
        this.updateChannelsInBackground();
        return cachedChannels;
      } else {
        readCounter.recordCacheMiss('stream_channels', 'StreamChat');
      }

      // Fetch from Stream API
      const filter = { 
        type: 'messaging', 
        members: { $in: [this.currentUser.id] } 
      };
      const sort = [{ last_message_at: -1 }];
      
      readCounter.recordRead('queryChannels', 'stream_channels', 'StreamChat', 1);
      const channels = await this.client.queryChannels(filter, sort, {
        watch: true,
        state: true
      });

      // Cache the results
      streamChatCacheService.setCachedChannels(channels);
      
      return channels;
    } catch (error) {
      console.error('Error fetching user channels:', error);
      throw error;
    }
  }

  // Background update for channels
  async updateChannelsInBackground() {
    try {
      const filter = { 
        type: 'messaging', 
        members: { $in: [this.currentUser.id] } 
      };
      const sort = [{ last_message_at: -1 }];
      
      readCounter.recordRead('queryChannels', 'stream_channels', 'StreamChat', 1);
      const channels = await this.client.queryChannels(filter, sort, {
        watch: true,
        state: true
      });

      // Update cache with fresh data
      streamChatCacheService.setCachedChannels(channels);
      console.log('Updated channels cache in background');
    } catch (error) {
      console.warn('Failed to update channels in background:', error);
    }
  }

  // Search for users in the organization with caching
  async searchUsers(searchTerm, organizationID) {
    if (!this.client) {
      throw new Error('Stream Chat client not initialized');
    }

    try {
      // Check cache first for quick local search
      const cachedUsers = streamChatCacheService.getCachedUsers();
      if (cachedUsers && searchTerm) {
        const localResults = streamChatCacheService.searchCachedUsers(searchTerm)
          .filter(user => user.organizationID === organizationID);
        
        if (localResults.length > 0) {
          readCounter.recordCacheHit('stream_users', 'StreamChat', localResults.length);
          console.log(`Found ${localResults.length} users in cache`);
          return localResults;
        }
      }

      readCounter.recordCacheMiss('stream_users', 'StreamChat');
      
      // Fetch from Stream API
      readCounter.recordRead('queryUsers', 'stream_users', 'StreamChat', 1);
      const response = await this.client.queryUsers({
        $and: [
          { organizationID: { $eq: organizationID } },
          {
            $or: [
              { name: { $autocomplete: searchTerm } },
              { email: { $autocomplete: searchTerm } }
            ]
          }
        ]
      });

      // Update cache with all users from organization for future searches
      if (response.users && response.users.length > 0) {
        const existingUsers = cachedUsers || [];
        const updatedUsers = [...existingUsers];
        
        response.users.forEach(user => {
          const existingIndex = updatedUsers.findIndex(u => u.id === user.id);
          if (existingIndex >= 0) {
            updatedUsers[existingIndex] = user;
          } else {
            updatedUsers.push(user);
          }
        });
        
        streamChatCacheService.setCachedUsers(updatedUsers);
      }

      return response.users;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Create or update user in Stream when they sign up or update profile
  async upsertUser(userData) {
    if (!this.client) {
      this.initializeClient();
    }

    try {
      const streamUserData = {
        id: userData.uid,
        name: userData.displayName || userData.email?.split('@')[0] || 'User',
        email: userData.email,
        image: userData.photoURL,
        role: userData.role || 'user',
        organizationID: userData.organizationID,
        isActive: userData.isActive !== false // Default to true if not specified
      };

      console.log('Updating Stream Chat user profile:', streamUserData.id);
      const response = await this.client.upsertUser(streamUserData);
      
      console.log('Stream Chat user profile updated successfully');
      return response;
    } catch (error) {
      console.error('Error upserting user in Stream Chat:', error);
      throw error;
    }
  }

  // Sync user profile changes to Stream Chat
  async syncUserProfile(firebaseUserData) {
    if (!this.isConnected()) {
      console.log('Stream Chat not connected, skipping user sync');
      return;
    }

    try {
      await this.upsertUser(firebaseUserData);
      console.log('User profile synced with Stream Chat');
    } catch (error) {
      console.warn('Failed to sync user profile with Stream Chat:', error);
      // Don't throw error - profile sync failure shouldn't break the app
    }
  }

  // Get users from the same organization for chat
  async getOrganizationUsers(organizationID, searchTerm = '') {
    if (!this.client) {
      throw new Error('Stream Chat client not initialized');
    }

    try {
      // Check cache first for organization users
      const cacheKey = `org_users_${organizationID}`;
      const cachedUsers = streamChatCacheService.getCachedUsers(cacheKey);
      
      if (cachedUsers && !searchTerm) {
        readCounter.recordCacheHit('stream_users', 'StreamChat', cachedUsers.length);
        console.log(`Found ${cachedUsers.length} organization users in cache`);
        return cachedUsers;
      }

      readCounter.recordCacheMiss('stream_users', 'StreamChat');
      
      // Build query for organization users
      const filters = {
        organizationID: { $eq: organizationID },
        isActive: { $eq: true }
      };

      // Add search filter if provided
      if (searchTerm) {
        filters.$or = [
          { name: { $autocomplete: searchTerm } },
          { email: { $autocomplete: searchTerm } }
        ];
      }

      readCounter.recordRead('queryUsers', 'stream_users', 'StreamChat', 1);
      const response = await this.client.queryUsers(filters, { name: 1 }, { limit: 50 });

      const users = response.users || [];
      
      // Cache organization users (without search term)
      if (!searchTerm && users.length > 0) {
        streamChatCacheService.setCachedUsers(cacheKey, users);
      }

      console.log(`Found ${users.length} users in organization ${organizationID}`);
      return users;
    } catch (error) {
      console.error('Error fetching organization users:', error);
      throw error;
    }
  }

  // Get the Stream client instance
  getClient() {
    return this.client;
  }

  // Get channel messages with caching
  async getChannelMessages(channelId, limit = 20, beforeDate = null) {
    if (!this.client || !this.currentUser) {
      throw new Error('User not connected to Stream Chat');
    }

    try {
      // Check cache first
      const cachedMessages = streamChatCacheService.getCachedChannelMessages(channelId);
      if (cachedMessages && cachedMessages.length > 0) {
        readCounter.recordCacheHit('stream_messages', 'StreamChat', cachedMessages.length);
        console.log(`Loaded ${cachedMessages.length} messages from cache for channel ${channelId}`);
        
        // Return cached data and update in background
        this.updateChannelMessagesInBackground(channelId);
        
        // Return requested page from cache
        const page = streamChatCacheService.getCachedMessagePage(channelId, limit, beforeDate);
        return page;
      } else {
        readCounter.recordCacheMiss('stream_messages', 'StreamChat');
      }

      // Fetch from Stream API
      const channel = this.client.channel('messaging', channelId);
      readCounter.recordRead('queryMessages', 'stream_messages', 'StreamChat', 1);
      
      const queryOptions = { limit };
      if (beforeDate) {
        queryOptions.created_at_before = beforeDate;
      }
      
      const response = await channel.query({
        messages: queryOptions
      });

      const messages = response.messages || [];
      
      // Cache the results
      if (messages.length > 0) {
        streamChatCacheService.setCachedChannelMessages(channelId, messages);
      }
      
      return {
        messages,
        hasMore: messages.length === limit,
        oldestMessage: messages.length > 0 ? messages[0] : null
      };
    } catch (error) {
      console.error(`Error fetching messages for channel ${channelId}:`, error);
      throw error;
    }
  }

  // Background update for channel messages
  async updateChannelMessagesInBackground(channelId) {
    try {
      const latestCachedTimestamp = streamChatCacheService.getLatestCachedMessageTimestamp(channelId);
      
      const channel = this.client.channel('messaging', channelId);
      const queryOptions = { limit: 20 };
      
      if (latestCachedTimestamp) {
        queryOptions.created_at_after = latestCachedTimestamp;
      }
      
      readCounter.recordRead('queryMessages', 'stream_messages', 'StreamChat', 1);
      const response = await channel.query({
        messages: queryOptions
      });

      const newMessages = response.messages || [];
      
      if (newMessages.length > 0) {
        // Append new messages to cache
        streamChatCacheService.appendNewChannelMessages(channelId, newMessages);
        console.log(`Updated ${newMessages.length} new messages in cache for channel ${channelId}`);
      }
    } catch (error) {
      console.warn(`Failed to update messages in background for channel ${channelId}:`, error);
    }
  }

  // Check if user is connected
  isConnected() {
    return !!(this.client && this.currentUser);
  }

  // Cache management methods
  clearCache() {
    streamChatCacheService.clearAllCache();
  }

  getCacheStats() {
    return streamChatCacheService.getCacheStats();
  }
}

// Create singleton instance
const streamChatService = new StreamChatService();
export default streamChatService;