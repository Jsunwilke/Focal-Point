import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Chat } from 'stream-chat-react';
import streamChatService from '../services/streamChatService';
import { useAuth } from './AuthContext';
import 'stream-chat-react/dist/css/v2/index.css';

const StreamChatContext = createContext({});

export const useStreamChat = () => {
  const context = useContext(StreamChatContext);
  if (!context) {
    throw new Error('useStreamChat must be used within StreamChatProvider');
  }
  return context;
};

export const StreamChatProvider = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [client, setClient] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionReady, setConnectionReady] = useState(false);
  const [listeners, setListeners] = useState(new Set());

  // Connect to Stream Chat when user logs in
  useEffect(() => {
    if (!user || !userProfile) {
      // User logged out or not ready
      if (client) {
        streamChatService.disconnectUser().catch(console.error);
        setClient(null);
        setConnectionReady(false);
      }
      setIsConnecting(false);
      setConnectionError(null);
      return;
    }

    const connectToStream = async (retryAttempt = 0) => {
      setIsConnecting(true);
      setConnectionError(null);

      try {
        // Check if environment variables are configured
        const apiKey = process.env.REACT_APP_STREAM_KEY;
        const apiSecret = process.env.REACT_APP_STREAM_SECRET;
        
        if (!apiKey || apiKey === 'your_stream_api_key_here') {
          throw new Error('Stream Chat API key is not configured. Please set REACT_APP_STREAM_KEY in your environment variables.');
        }
        
        // Note: API secret is only used for development token generation
        // Production should use server-side token generation via Firebase Function

        // Combine Firebase user data with profile data
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: userProfile.displayName || user.displayName,
          photoURL: userProfile.photoURL || user.photoURL,
          role: userProfile.role,
          organizationID: userProfile.organizationID
        };

        await streamChatService.connectUser(userData);
        const streamClient = streamChatService.getClient();
        setClient(streamClient);
        setConnectionReady(true);
        setRetryCount(0);
        
        console.log('Stream Chat connected successfully');
      } catch (error) {
        console.error('Failed to connect to Stream Chat:', error);
        setConnectionError(error.message);
        setConnectionReady(false);
        
        // Implement retry logic (max 3 attempts)
        if (retryAttempt < 2 && !error.message.includes('not configured')) {
          console.log(`Retrying Stream Chat connection (attempt ${retryAttempt + 2}/3)...`);
          setTimeout(() => {
            setRetryCount(retryAttempt + 1);
            connectToStream(retryAttempt + 1);
          }, 2000 * (retryAttempt + 1)); // Exponential backoff
        }
      } finally {
        setIsConnecting(false);
      }
    };

    connectToStream();

    // Cleanup on unmount
    return () => {
      // Clean up all listeners
      listeners.forEach(listener => {
        if (typeof listener === 'function') {
          listener();
        }
      });
      setListeners(new Set());
      
      // Disconnect from Stream Chat
      streamChatService.disconnectUser().catch(console.error);
    };
  }, [user, userProfile]);

  // Retry connection function
  const retryConnection = () => {
    if (user && userProfile) {
      setRetryCount(0);
      setConnectionError(null);
      
      const connectToStream = async () => {
        setIsConnecting(true);
        setConnectionError(null);

        try {
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: userProfile.displayName || user.displayName,
            photoURL: userProfile.photoURL || user.photoURL,
            role: userProfile.role,
            organizationID: userProfile.organizationID
          };

          await streamChatService.connectUser(userData);
          setClient(streamChatService.getClient());
          setConnectionReady(true);
        } catch (error) {
          console.error('Failed to retry Stream Chat connection:', error);
          setConnectionError(error.message);
          setConnectionReady(false);
        } finally {
          setIsConnecting(false);
        }
      };

      connectToStream();
    }
  };

  // Sync user profile changes to Stream Chat
  const syncUserProfile = useCallback(async (updatedUserData) => {
    if (!connectionReady || !client) {
      console.log('Stream Chat not ready, skipping profile sync');
      return;
    }

    try {
      await streamChatService.syncUserProfile(updatedUserData);
      console.log('User profile synced with Stream Chat');
    } catch (error) {
      console.warn('Failed to sync user profile with Stream Chat:', error);
    }
  }, [connectionReady, client]);

  // Get organization users for chat
  const getOrganizationUsers = useCallback(async (searchTerm = '') => {
    if (!connectionReady || !userProfile?.organizationID) {
      return [];
    }

    try {
      return await streamChatService.getOrganizationUsers(userProfile.organizationID, searchTerm);
    } catch (error) {
      console.error('Failed to get organization users:', error);
      return [];
    }
  }, [connectionReady, userProfile?.organizationID]);

  // Listener management for cleanup
  const addListener = useCallback((cleanup) => {
    setListeners(prev => new Set([...prev, cleanup]));
    return cleanup;
  }, []);

  const removeListener = useCallback((cleanup) => {
    setListeners(prev => {
      const newSet = new Set(prev);
      newSet.delete(cleanup);
      return newSet;
    });
  }, []);

  const value = {
    client,
    isConnecting,
    connectionError,
    connectionReady,
    retryCount,
    retryConnection,
    addListener,
    removeListener,
    streamChatService,
    // User management functions
    syncUserProfile,
    getOrganizationUsers
  };

  // If client is ready and connected, wrap children with Stream's Chat component
  if (client && connectionReady && !isConnecting) {
    return (
      <StreamChatContext.Provider value={value}>
        <Chat client={client} theme="str-chat__theme-light">
          {children}
        </Chat>
      </StreamChatContext.Provider>
    );
  }

  // Otherwise, just provide the context without Stream's Chat wrapper
  return (
    <StreamChatContext.Provider value={value}>
      {children}
    </StreamChatContext.Provider>
  );
};